import { lstatSync, readFileSync, statSync, writeFileSync } from 'fs';
import { relative, resolve } from 'path';

import { EExitCode, resolveCwdRelativePath } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { resolveCliRelativePath } from '../../helpers/paths.ts';
import { AbstractApiWithProgressExecutor } from '../abstract/AbstractApiWithProgressExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import type { Options } from 'prettier';

// Directories prettier's CLI always prunes during pattern expansion.
const IGNORED_DIRECTORIES = ['.git', '.sl', '.svn', '.hg', '.jj', 'node_modules'];

// Ignore files prettier respects by default (the CLI's `--ignore-path` default).
const IGNORE_FILES = ['.gitignore', '.prettierignore'];

// Prettier's JS API has no cache/cacheLocation option of its own (unlike
// ESLint/Stylelint), so caching here is hand-rolled: a size+mtime snapshot per
// file, mirroring the "metadata" cache strategy those tools default to. Only
// files confirmed clean (or freshly fixed) are written back, so anything left
// unformatted keeps getting rechecked every run until it's actually fixed.
interface ICacheEntry {
  size: number;
  mtime: number;
}

type TCache = Record<string, ICacheEntry>;

export class PrettierExecutor extends AbstractApiWithProgressExecutor {
  static readonly CACHE_PATH = resolveCliRelativePath('/bin/.prettiercache');

  // Set in prepare(), consumed in execute(): the explicit patterns to format and
  // whether they came from a caller-supplied file list (vs. the configured sources).
  private patterns: string[] = [];
  private explicitFiles = false;

  // Set in execute(): the cache read at the start of the run, the one written
  // back at the end (only ever contains entries for files confirmed clean),
  // and whether caching is active at all for this run.
  private cache: TCache = {};
  private nextCache: TCache = {};
  private cacheEnabled = false;

  protected getCommandName(): string {
    return 'prettier';
  }

  protected async prepare(
    args: string[],
    options: IExecutorOptions,
    files: string[] = []
  ): Promise<EExitCode> {
    const { srcPath, modules } = this.modulesConfig;

    this.explicitFiles = files.length > 0;
    this.patterns = this.explicitFiles ? files : (modules?.prettier?.sources ?? [srcPath]);

    return super.prepare(args, options, files);
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

    this.cacheEnabled = !options.disableCache;
    this.cache = this.cacheEnabled ? this.readCache() : {};
    this.nextCache = {};

    const result = options.json
      ? await this.report(prettier, targets, configPath, options.output)
      : await this.format(prettier, targets, configPath, options.fix, this.showProgress(options));

    if (this.cacheEnabled) {
      writeFileSync(PrettierExecutor.CACHE_PATH, JSON.stringify(this.nextCache));
    }

    return result;
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
      const stat = this.statFor(file);

      if (this.cacheEnabled && this.isCached(file, stat)) {
        this.nextCache[file] = stat;

        continue;
      }

      const options = await this.optionsFor(prettier, file, configPath);

      if (await prettier.check(readFileSync(file, 'utf8'), options)) {
        if (this.cacheEnabled) {
          this.nextCache[file] = stat;
        }
      } else {
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
    fix: boolean,
    showProgress: boolean
  ): Promise<EExitCode> {
    process.stdout.write('Checking formatting...\n');

    let unformatted = 0;
    let errors = 0;

    for (const file of targets) {
      const display = toPosix(file);

      if (showProgress) {
        this.printProgress(display);
      }

      const outcome = await this.processFile(
        prettier,
        file,
        display,
        configPath,
        fix,
        showProgress
      );

      if (outcome === 'error') {
        errors += 1;
      } else if (outcome === 'unformatted') {
        unformatted += 1;
      }
    }

    if (showProgress) {
      // summarize() below always prints its own final status line, so just
      // clear the in-place progress line rather than adding a redundant one.
      this.clearProgress();
    }

    return this.summarize({ unformatted, errors, fix });
  }

  // Checks the cache before doing any real work, then delegates to
  // formatFile(); a cache hit short-circuits as 'ok' without touching
  // prettier at all. Also owns the caching decision once formatFile() returns
  // — see the inline comment below for which outcomes are safe to cache.
  private async processFile(
    prettier: typeof import('prettier'),
    file: string,
    display: string,
    configPath: string,
    fix: boolean,
    showProgress: boolean
  ): Promise<'ok' | 'unformatted' | 'error'> {
    const stat = this.statFor(file);

    if (this.cacheEnabled && this.isCached(file, stat)) {
      this.nextCache[file] = stat;

      return 'ok';
    }

    const outcome = await this.formatFile(prettier, file, display, configPath, fix, showProgress);

    // In `--check` mode only a clean file is safe to cache — an unformatted
    // one must be rechecked every run until it's actually fixed. In `--fix`
    // mode the file is guaranteed clean on disk either way (formatFile() just
    // rewrote it if it wasn't already), so it's always safe to cache; re-stat
    // since a rewrite changes its mtime/size.
    if (this.cacheEnabled && outcome !== 'error' && (fix || outcome === 'ok')) {
      this.nextCache[file] = fix ? this.statFor(file) : stat;
    }

    return outcome;
  }

  // Formats (or checks) a single file and reports the outcome. `--fix` mirrors
  // ESLint's fix mode and prints no per-file lines, only a final summary;
  // `--check` still prints as it finds issues, via reportIssue().
  private async formatFile(
    prettier: typeof import('prettier'),
    file: string,
    display: string,
    configPath: string,
    fix: boolean,
    showProgress: boolean
  ): Promise<'ok' | 'unformatted' | 'error'> {
    const options = await this.optionsFor(prettier, file, configPath);
    const input = readFileSync(file, 'utf8');

    let isDifferent: boolean;

    try {
      if (fix) {
        const output = await prettier.format(input, options);
        isDifferent = output !== input;

        if (isDifferent) {
          writeFileSync(file, output);
        }
      } else {
        isDifferent = !(await prettier.check(input, options));
      }
    } catch (error) {
      this.reportIssue(fix, showProgress, () =>
        process.stderr.write(`${prefix('error')} ${display}: ${String(error)}\n`)
      );

      return 'error';
    }

    if (isDifferent) {
      this.reportIssue(fix, showProgress, () =>
        process.stderr.write(`${prefix('warn')} ${display}\n`)
      );

      return 'unformatted';
    }

    return 'ok';
  }

  // Only `--check` prints per-file lines; clear the in-place progress line
  // first so the persistent line doesn't get appended to it mid-overwrite.
  private reportIssue(fix: boolean, showProgress: boolean, write: () => void): void {
    if (fix) {
      return;
    }

    if (showProgress) {
      this.clearProgress();
    }

    write();
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
    // `--fix` prints no per-file lines (matching ESLint's fix mode), so it has
    // nothing "above" to point back to; `--check` still lists each offending
    // file as it goes, so the summary can refer back to it.
    const pluralize = (count: number): string => (count === 1 ? '1 file' : `${count} files`);
    const describe = (count: number): string =>
      fix || count > 1 ? pluralize(count) : 'the above file';

    if (errors > 0) {
      process.stdout.write(`Error occurred when checking code style in ${describe(errors)}.\n`);

      return EExitCode.EXCEPTION;
    }

    if (unformatted === 0) {
      process.stdout.write('All matched files use Prettier code style!\n');

      return EExitCode.OK;
    }

    process.stderr.write(
      `${prefix('warn')} ${
        fix
          ? `Code style issues fixed in ${describe(unformatted)}.`
          : `Code style issues found in ${describe(unformatted)}. Run Prettier with --write to fix.`
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

  // Reads the cache written by the previous run; a missing or corrupt file
  // (first run, or a manually-cleared cache) is treated as an empty cache.
  private readCache(): TCache {
    try {
      return JSON.parse(readFileSync(PrettierExecutor.CACHE_PATH, 'utf8')) as TCache;
    } catch {
      return {};
    }
  }

  private statFor(file: string): ICacheEntry {
    const stat = statSync(file);

    return { size: stat.size, mtime: stat.mtimeMs };
  }

  private isCached(file: string, stat: ICacheEntry): boolean {
    const cached = this.cache[file];

    return cached?.size === stat.size && cached?.mtime === stat.mtime;
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
