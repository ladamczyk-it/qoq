import { lstatSync, readFileSync, writeFileSync } from 'fs';
import { relative, resolve } from 'path';

import { EExitCode, resolveCwdRelativePath } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { AbstractApiExecutor } from '../abstract/AbstractApiExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import type { Options } from 'prettier';

// Directories prettier's CLI always prunes during pattern expansion.
const IGNORED_DIRECTORIES = ['.git', '.sl', '.svn', '.hg', '.jj', 'node_modules'];

// Ignore files prettier respects by default (the CLI's `--ignore-path` default).
const IGNORE_FILES = ['.gitignore', '.prettierignore'];

export class PrettierExecutor extends AbstractApiExecutor {
  // Set in prepare(), consumed in execute(): the explicit patterns to format and
  // whether they came from a caller-supplied file list (vs. the configured sources).
  private patterns: string[] = [];
  private explicitFiles = false;

  protected getCommandName(): string {
    return 'prettier';
  }

  protected prepare(
    _args: string[],
    _options: IExecutorOptions,
    files: string[] = []
  ): Promise<EExitCode> {
    const { srcPath, modules } = this.modulesConfig;

    this.explicitFiles = files.length > 0;
    this.patterns = this.explicitFiles ? files : (modules?.prettier?.sources ?? [srcPath]);

    return Promise.resolve(EExitCode.OK);
  }

  protected async execute(_args: string[], options: IExecutorOptions): Promise<string | EExitCode> {
    // Resolved from the consumer's on-demand install (via the @ladamczyk/qoq-prettier*
    // templates); kept external in rollup.bin.js.
    const prettier = await import('prettier');

    const configPath = resolveCwdRelativePath(this.modulesConfig.configPaths.prettier);
    const targets = await this.resolveTargets(prettier);

    if (targets.length === 0) {
      // Nothing to format (e.g. every caller-supplied file is ignored): match the
      // old behaviour of returning OK without emitting any prettier output.
      throw new TerminateExecutorGracefully();
    }

    if (options.json) {
      return this.report(prettier, targets, configPath, options.output);
    }

    return this.format(prettier, targets, configPath, options.fix);
  }

  // `--json`: collect the files that are not Prettier-formatted into a lean
  // { issues: string[] } report, without writing files or printing to the console.
  private async report(
    prettier: typeof import('prettier'),
    targets: string[],
    configPath: string,
    output: string
  ): Promise<EExitCode> {
    const issues: string[] = [];

    for (const file of targets) {
      const options = await this.optionsFor(prettier, file, configPath);

      if (!(await prettier.check(readFileSync(file, 'utf8'), options))) {
        issues.push(toPosix(file));
      }
    }

    this.writeReport({ issues }, output);

    return issues.length > 0 ? EExitCode.ERROR : EExitCode.OK;
  }

  // Reproduces prettier's `--check` (and `--check --write` when fixing) console
  // output and exit semantics over the resolved targets.
  private async format(
    prettier: typeof import('prettier'),
    targets: string[],
    configPath: string,
    fix: boolean
  ): Promise<EExitCode> {
    process.stdout.write('Checking formatting...\n');

    let unformatted = 0;
    let errors = 0;

    for (const file of targets) {
      const display = toPosix(file);
      const options = await this.optionsFor(prettier, file, configPath);
      const input = readFileSync(file, 'utf8');

      let isDifferent: boolean;

      try {
        if (fix) {
          const start = Date.now();
          const output = await prettier.format(input, options);
          isDifferent = output !== input;
          const timing = `${Date.now() - start}ms`;

          if (isDifferent) {
            writeFileSync(file, output);
            process.stdout.write(`${display} ${timing}\n`);
          } else {
            process.stdout.write(c.gray(`${display} ${timing} (unchanged)\n`));
          }
        } else {
          isDifferent = !(await prettier.check(input, options));
        }
      } catch (error) {
        errors += 1;
        process.stderr.write(`${prefix('error')} ${display}: ${String(error)}\n`);

        continue;
      }

      if (isDifferent) {
        unformatted += 1;
        process.stderr.write(`${prefix('warn')} ${display}\n`);
      }
    }

    return this.summarize({ unformatted, errors, fix });
  }

  private summarize({
    unformatted,
    errors,
    fix,
  }: {
    unformatted: number;
    errors: number;
    fix: boolean;
  }): EExitCode {
    if (errors > 0) {
      const files = errors === 1 ? 'the above file' : `${errors} files`;
      process.stdout.write(`Error occurred when checking code style in ${files}.\n`);

      return EExitCode.EXCEPTION;
    }

    if (unformatted === 0) {
      process.stdout.write('All matched files use Prettier code style!\n');

      return EExitCode.OK;
    }

    const files = unformatted === 1 ? 'the above file' : `${unformatted} files`;
    process.stderr.write(
      `${prefix('warn')} ${
        fix
          ? `Code style issues fixed in ${files}.`
          : `Code style issues found in ${files}. Run Prettier with --write to fix.`
      }\n`
    );

    // `--write` fixes the issues, so it never fails the run; `--check` does.
    return fix ? EExitCode.OK : EExitCode.ERROR;
  }

  // Resolves the per-file prettier options from the configured config file.
  private async optionsFor(
    prettier: typeof import('prettier'),
    file: string,
    configPath: string
  ): Promise<Options> {
    const config = await prettier.resolveConfig(file, { config: configPath, editorconfig: true });

    return { ...config, filepath: file };
  }

  // Expands the patterns to concrete files and drops the ones prettier would not
  // format: those matched by .gitignore/.prettierignore and those whose parser
  // cannot be inferred (the CLI's `--ignore-unknown` behaviour).
  private async resolveTargets(prettier: typeof import('prettier')): Promise<string[]> {
    const targets: string[] = [];

    for (const file of await this.expandPatterns()) {
      const { ignored, inferredParser } = await prettier.getFileInfo(file, {
        ignorePath: IGNORE_FILES,
        withNodeModules: false,
        resolveConfig: true,
      });

      if (!ignored && inferredParser) {
        targets.push(file);
      }
    }

    return targets;
  }

  // Mirrors prettier's CLI pattern expansion: explicit files pass through, a
  // directory expands to `<dir>/**/*`, and anything else is treated as a glob.
  private async expandPatterns(): Promise<string[]> {
    const { default: fastGlob } = await import('fast-glob');

    const cwd = process.cwd();
    const files: string[] = [];
    const globs: string[] = [];

    for (const pattern of this.patterns) {
      const stat = statSafe(resolve(cwd, pattern));

      if (stat?.isFile()) {
        files.push(pattern);
      } else if (stat?.isDirectory()) {
        const prefixPath = relative(cwd, resolve(cwd, pattern)) || '.';
        globs.push(`${prefixPath}/**/*`);
      } else if (!pattern.startsWith('!')) {
        globs.push(pattern);
      }
    }

    const matched = globs.length
      ? await fastGlob(globs, {
          cwd,
          dot: true,
          onlyFiles: true,
          followSymbolicLinks: false,
          ignore: IGNORED_DIRECTORIES.map((directory) => `**/${directory}`),
        })
      : [];

    return [...new Set([...files, ...matched])].sort((a, b) => a.localeCompare(b));
  }
}

// Prettier's logger prefixes warn/error lines with a coloured `[warn]`/`[error]`.
const prefix = (level: 'warn' | 'error'): string =>
  `[${(level === 'warn' ? c.yellow : c.red)(level)}]`;

const toPosix = (path: string): string => path.replaceAll('\\', '/');

const statSafe = (path: string): ReturnType<typeof lstatSync> | undefined => {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
};
