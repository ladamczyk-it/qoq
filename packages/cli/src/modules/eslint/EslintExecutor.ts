import { existsSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';

import { EExitCode, resolveCwdRelativePath } from '@ladamczyk/qoq-utils';
import { flattenDeep } from 'es-toolkit/compat';
import micromatch from 'micromatch';

import { GITIGNORE_FILE_PATH } from '../../helpers/constants.ts';
import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { formatCode } from '../../helpers/formatCode.ts';
import { resolveCliPackagePath, resolveCliRelativePath } from '../../helpers/paths.ts';
import { EConfigType } from '../../helpers/types.ts';
import { AbstractExecutor } from '../abstract/AbstractExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import { EModulesEslint, IModuleEslintConfig } from './types.ts';

import type { ESLint } from 'eslint';

interface IEslintReportMessage {
  ruleId: string | null;
  severity: number;
  message: string;
  line: number;
  column: number;
  fix: boolean;
}

type TEslintReport = { filePath: string; messages: IEslintReportMessage[] }[];

export class EslintExecutor extends AbstractExecutor {
  static readonly CACHE_PATH = resolveCliRelativePath('/bin/.eslintcache');

  // Resolved in prepare(), consumed in execute() — eslint runs through its JS API
  // rather than a spawned binary, so there are no CLI args to carry state.
  private targets: string[] = ['.'];
  private configFile = '';

  protected getCommandName(): string {
    return 'eslint';
  }

  // eslint runs through its JS API in execute(); no binary args are spawned.
  protected getCommandArgs(): string[] {
    return [];
  }

  protected async execute(_args: string[], options: IExecutorOptions): Promise<string | EExitCode> {
    // Resolved from the consumer's on-demand install (via the @ladamczyk/qoq-eslint-v9-*
    // templates that bring in `eslint`); kept external in rollup.bin.js.
    const { ESLint } = await import('eslint');

    const eslint = new ESLint({
      overrideConfigFile: this.configFile,
      cache: !options.disableCache,
      cacheLocation: EslintExecutor.CACHE_PATH,
      cacheStrategy: 'metadata',
      fix: options.fix,
      concurrency: options.concurrency,
    });

    const results = await eslint.lintFiles(this.targets);

    if (options.fix) {
      await ESLint.outputFixes(results);
    }

    const { errorCount, warningCount } = results.reduce(
      (acc, result) => ({
        errorCount: acc.errorCount + result.errorCount,
        warningCount: acc.warningCount + result.warningCount,
      }),
      { errorCount: 0, warningCount: 0 }
    );

    // Mirrors the spawned CLI's `--max-warnings 0`: any warning fails the run.
    const tooManyWarnings = warningCount > 0;

    if (options.json) {
      writeFileSync(
        `${options.output}/eslint-report.json`,
        JSON.stringify(this.buildReport(results))
      );
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

      const content = (modules?.eslint ?? []).reduce(
        (acc: string[], current: IModuleEslintConfig, index) => {
          const { template, ...rest } = current;

          if (Object.values(EModulesEslint).includes(template as EModulesEslint)) {
            if (configType === EConfigType.ESM) {
              imports[`{ baseConfig as baseConfig${index} }`] = `@ladamczyk/${template}`;
            } else {
              imports[`{ baseConfig: baseConfig${index} }`] = `@ladamczyk/${template}`;
            }

            acc.push(
              `const config${index} = [objectMergeRight(baseConfig${index}, ${JSON.stringify(rest)})]`
            );
          } else {
            acc.push(`const config${index} = [${JSON.stringify(rest)}]`);
          }

          return acc;
        },
        []
      );

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
