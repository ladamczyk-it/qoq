import { existsSync, writeFileSync } from 'fs';
import { relative } from 'path';
import { pathToFileURL } from 'url';

import { EExitCode, resolveCwdRelativePath } from '@ladamczyk/qoq-utils';
import { flattenDeep } from 'es-toolkit/compat';
import micromatch from 'micromatch';

import { GITIGNORE_FILE_PATH } from '../../helpers/constants.ts';
import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { formatCode } from '../../helpers/formatCode.ts';
import { resolveCliPackagePath, resolveCliRelativePath } from '../../helpers/paths.ts';
import { EConfigType } from '../../helpers/types.ts';
import {
  AbstractApiWithProgressExecutor,
  PROGRESS_PLUGIN_NAMESPACE,
  PROGRESS_RULE_ID,
  PROGRESS_RULE_NAME,
} from '../abstract/AbstractApiWithProgressExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import { EModulesEslint, IModuleEslintConfig } from './types.ts';

import type { ESLint, Linter, Rule } from 'eslint';

interface IEslintReportMessage {
  ruleId: string | null;
  severity: number;
  message: string;
  line: number;
  column: number;
  fix: boolean;
}

type TEslintReport = { filePath: string; messages: IEslintReportMessage[] }[];

export class EslintExecutor extends AbstractApiWithProgressExecutor {
  static readonly CACHE_PATH = resolveCliRelativePath('/bin/.eslintcache');

  // Resolved in prepare(), consumed in execute() — eslint runs through its JS API
  // rather than a spawned binary, so there are no CLI args to carry state.
  private targets: string[] = ['.'];
  private configFile = '';

  protected getCommandName(): string {
    return 'eslint';
  }

  protected async execute(_args: string[], options: IExecutorOptions): Promise<string | EExitCode> {
    // Resolved from the consumer's on-demand install (via the @ladamczyk/qoq-eslint-v9-*
    // templates that bring in `eslint`); kept external in rollup.bin.js.
    const { ESLint } = await import('eslint');

    const showProgress = this.showProgress(options);
    // Cache hits skip rule execution entirely, so the progress rule below never
    // fires for unchanged files; every filename it does reach is recorded here
    // so the post-lint backfill (mirroring Prettier's exhaustive per-target
    // loop) knows which targets still need a progress line printed.
    const progressedFiles = new Set<string>();

    const eslint = new ESLint({
      overrideConfigFile: this.configFile,
      cache: !options.disableCache,
      cacheLocation: EslintExecutor.CACHE_PATH,
      cacheStrategy: 'metadata',
      fix: options.fix,
      concurrency: options.concurrency,
      ...(showProgress ? { overrideConfig: this.getProgressOverrideConfig(progressedFiles) } : {}),
    });

    const results = await eslint.lintFiles(this.targets);

    if (options.fix) {
      await ESLint.outputFixes(results);
    }

    if (showProgress) {
      this.backfillProgress(results, progressedFiles);
    }

    const { errorCount, warningCount } = this.countResults(results);

    // Mirrors the spawned CLI's `--max-warnings 0`: any warning fails the run.
    const tooManyWarnings = warningCount > 0;

    if (showProgress) {
      this.finishProgress(errorCount === 0 && !tooManyWarnings);
    }

    if (options.json) {
      this.writeReport(this.buildReport(results), options.output);
    } else {
      const formatter = await eslint.loadFormatter('stylish');
      const output = await formatter.format(results);

      if (output) {
        process.stdout.write(`${output}\n`);
      }
    }

    // The stylish formatter doesn't surface the warning cap; the CLI prints this
    // line separately, only when warnings (not errors) break the threshold.
    if (errorCount === 0 && tooManyWarnings) {
      process.stderr.write('ESLint found too many warnings (maximum: 0).\n');
    }

    return errorCount > 0 || tooManyWarnings ? EExitCode.ERROR : EExitCode.OK;
  }

  protected async prepare(
    args: string[],
    options: IExecutorOptions,
    files: string[] = []
  ): Promise<EExitCode> {
    try {
      const {
        configType,
        modules,
        configPaths: { eslint: configPath },
      } = this.modulesConfig;
      const configFilePath = resolveCliPackagePath(
        `/bin/eslint.config.${configType === EConfigType.ESM ? 'm' : 'c'}js`
      );

      const imports: Record<string, string> = {
        '{ objectMergeRight }': '@ladamczyk/qoq-utils',
        '{ includeIgnoreFile }': '@eslint/compat',
      };

      // Every @ladamczyk/qoq-eslint-v9-* template bundles eslint-plugin-prettier so
      // formatting issues surface as lint errors during local dev. Running Prettier
      // through ESLint's AST-based rule pipeline is much slower than running it
      // directly though, and CI already runs the standalone Prettier check, so CI
      // runs strip the plugin here instead of paying for it twice.
      let usesStripPrettierPlugin = false;

      const content = (modules?.eslint ?? []).reduce(
        (acc: string[], current: IModuleEslintConfig, index) => {
          const { template, ...rest } = current;

          if (Object.values(EModulesEslint).includes(template as EModulesEslint)) {
            if (configType === EConfigType.ESM) {
              imports[`{ baseConfig as baseConfig${index} }`] = `@ladamczyk/${template}`;
            } else {
              imports[`{ baseConfig: baseConfig${index} }`] = `@ladamczyk/${template}`;
            }

            const merged = `objectMergeRight(baseConfig${index}, ${JSON.stringify(rest)})`;

            if (options.ci) {
              usesStripPrettierPlugin = true;
              acc.push(`const config${index} = [stripPrettierPlugin(${merged})]`);
            } else {
              acc.push(`const config${index} = [${merged}]`);
            }
          } else {
            acc.push(`const config${index} = [${JSON.stringify(rest)}]`);
          }

          return acc;
        },
        []
      );

      if (usesStripPrettierPlugin) {
        imports['{ stripPrettierPlugin }'] = '@ladamczyk/qoq-utils';
      }

      const mergeConfigsInitialArray = existsSync(GITIGNORE_FILE_PATH)
        ? `[includeIgnoreFile('${GITIGNORE_FILE_PATH.replaceAll('\\', '\\\\')}')]`
        : '[]';

      const exports = `${mergeConfigsInitialArray}${(modules?.eslint ?? [])
        .map((_, index) => `.concat(config${index})`)
        .join('')}`;

      writeFileSync(configFilePath, formatCode(configType, imports, content, exports));

      this.configFile = resolveCwdRelativePath(configPath);

      // No explicit files: mirror the CLI's no-pattern default of linting the cwd
      // and letting the flat config's own `files`/`ignores` decide the scope.
      this.targets = ['.'];

      if (files.length > 0) {
        // eslint-disable-next-line sonarjs/no-dead-store
        let filteredFiles = [...files];

        try {
          const eslintConfig = await import(pathToFileURL(configFilePath).toString());
          const mapCallback = (entry: string) =>
            entry.startsWith('**') || entry.startsWith('./') ? entry : `**/${entry}`;
          const prepareCollection = (patterns: string[] | undefined) => {
            let collection: string[];

            if (patterns) {
              collection = Array.isArray(patterns) ? flattenDeep(patterns) : [patterns];
            } else {
              collection = [];
            }

            return collection.map(mapCallback);
          };

          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const possibleFiles = (eslintConfig.default as IModuleEslintConfig[]).reduce(
            (acc: { files: string[]; ignores: string[] }[], config) =>
              acc.concat([
                {
                  files: prepareCollection(config.files as string[] | undefined),
                  ignores: prepareCollection(config.ignores),
                },
              ]),
            []
          );

          const shouldLintFile = (file: string) =>
            possibleFiles.some(
              ({ files: filesPatterns, ignores: ignoresPatterns }) =>
                micromatch.isMatch(file, filesPatterns) &&
                !micromatch.isMatch(file, ignoresPatterns)
            );

          filteredFiles = files.filter((file) => shouldLintFile(file));
        } catch {
          throw new Error();
        }

        if (filteredFiles.length === 0) {
          throw new TerminateExecutorGracefully();
        }

        this.targets = filteredFiles;
      }

      return super.prepare(args, options, files);
    } catch (e) {
      return this.handlePrepareError(e);
    }
  }

  // Cache hits skip rule execution (including the progress rule) for unchanged
  // files, so a warm-cache run would otherwise show no progress at all — unlike
  // Prettier, which has no cache and reports every target on every run. Prints
  // a progress line for any result the live rule never reached, so every run
  // shows the full target list exactly like Prettier's.
  private backfillProgress(results: ESLint.LintResult[], progressedFiles: Set<string>): void {
    for (const result of results) {
      const display = toPosix(relative(process.cwd(), result.filePath));

      if (!progressedFiles.has(display)) {
        this.printProgress(display);
      }
    }
  }

  private countResults(results: ESLint.LintResult[]): { errorCount: number; warningCount: number } {
    return results.reduce(
      (acc, result) => ({
        errorCount: acc.errorCount + result.errorCount,
        warningCount: acc.warningCount + result.warningCount,
      }),
      { errorCount: 0, warningCount: 0 }
    );
  }

  // ESLint's JS API exposes no per-file callback on `lintFiles()`; a rule's
  // create() (called once per linted file, before AST traversal, regardless of
  // what its visitor listens for) is the only hook available. Appended via
  // `overrideConfig`, which ESLint merges in as the highest-precedence entry of
  // the flat-config cascade, so it applies to every file without touching the
  // generated config file itself.
  private getProgressOverrideConfig(progressedFiles: Set<string>): Linter.Config {
    const printProgress = (file: string): void => this.printProgress(file);

    const progressRule: Rule.RuleModule = {
      meta: { type: 'suggestion', schema: [] },
      create(context) {
        const display = toPosix(relative(context.cwd, context.filename));

        progressedFiles.add(display);
        printProgress(display);

        return {};
      },
    };

    return {
      plugins: { [PROGRESS_PLUGIN_NAMESPACE]: { rules: { [PROGRESS_RULE_NAME]: progressRule } } },
      // Severity is irrelevant here: the rule never calls context.report(), so
      // it never contributes to error/warning counts.
      rules: { [PROGRESS_RULE_ID]: 1 },
    };
  }

  // Lean JSON report for `--json`: drop each result's full `source`/`output`
  // file blobs (eslint's reports can be tens of thousands of lines) and keep
  // only what summarize.mjs needs — per-file messages with rule, severity,
  // location and a `fix` flag derived from eslint's fix object.
  private buildReport(results: ESLint.LintResult[]): TEslintReport {
    return results.map((result) => ({
      filePath: result.filePath,
      messages: result.messages.map((message) => ({
        ruleId: message.ruleId,
        severity: message.severity,
        message: message.message,
        line: message.line,
        column: message.column,
        fix: Boolean(message.fix),
      })),
    }));
  }
}

const toPosix = (path: string): string => path.replaceAll('\\', '/');
