/* eslint-disable sonarjs/cognitive-complexity */
import { writeFileSync } from 'fs';

import { StylelintConfig } from '@ladamczyk/qoq-stylelint-css';
import { EExitCode, resolveCwdRelativePath } from '@ladamczyk/qoq-utils';
import micromatch from 'micromatch';

import { readIgnorePatterns } from '../../helpers/common.ts';
import { GITIGNORE_FILE_PATH } from '../../helpers/constants.ts';
import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { formatCode } from '../../helpers/formatCode.ts';
import { resolveCliPackagePath, resolveCliRelativePath } from '../../helpers/paths.ts';
import { EConfigType } from '../../helpers/types.ts';
import { AbstractExecutor } from '../abstract/AbstractExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import {
  EModulesStylelint,
  type IModuleStylelintConfigWithPattern,
  type IModuleStylelintConfigWithTemplate,
} from './types.ts';

import type { LinterResult } from 'stylelint';

interface IStylelintReportWarning {
  line: number;
  column: number;
  rule: string;
  severity: string;
  text: string;
  fixable: boolean;
}

type TStylelintReport = { source: string | undefined; warnings: IStylelintReportWarning[] }[];

export class StylelintExecutor extends AbstractExecutor {
  static readonly CACHE_PATH = resolveCliRelativePath('/bin/.stylelintcache');

  // Resolved in prepare(), consumed in execute() — stylelint runs through its JS
  // API rather than a spawned binary, so there are no CLI args to carry state.
  private targets: string[] = [];
  private strict = false;
  private configFile = '';

  protected getCommandName(): string {
    return 'stylelint';
  }

  protected getCommandArgs(): string[] {
    return [];
  }

  protected async execute(_args: string[], options: IExecutorOptions): Promise<string | EExitCode> {
    const { default: stylelint } = await import('stylelint');

    const result = await stylelint.lint({
      files: this.targets,
      configFile: this.configFile,
      fix: options.fix,
      cache: !options.disableCache,
      cacheLocation: StylelintExecutor.CACHE_PATH,
      cacheStrategy: 'metadata',
      formatter: 'string',
      allowEmptyInput: true,
      ...(this.strict ? { maxWarnings: 0 } : {}),
    });

    if (options.json) {
      writeFileSync(
        `${options.output}/stylelint-report.json`,
        JSON.stringify(this.buildReport(result))
      );
    } else {
      process.stdout.write(result.report);
    }

    return result.errored || result.maxWarningsExceeded ? EExitCode.ERROR : EExitCode.OK;
  }

  protected async prepare(
    args: string[],
    options: IExecutorOptions,
    files: string[] = []
  ): Promise<EExitCode> {
    const {
      srcPath,
      configType,
      modules: { stylelint },
      configPaths: { stylelint: configPath },
    } = this.modulesConfig;

    if (!stylelint) {
      throw new TerminateExecutorGracefully();
    }

    const { strict } = stylelint;
    this.strict = strict;

    let rest: StylelintConfig;
    let glob: string;

    if ((<IModuleStylelintConfigWithPattern>stylelint).pattern) {
      const { pattern, ...other } = <IModuleStylelintConfigWithPattern>stylelint;

      rest = other;
      glob = pattern;
    } else if ((<IModuleStylelintConfigWithTemplate>stylelint).template) {
      const { template, ...other } = <IModuleStylelintConfigWithTemplate>stylelint;

      rest = other;
      glob =
        template === EModulesStylelint.STYLELINT_SCSS
          ? `${srcPath}/**/*.{css,scss,sass}`
          : `${srcPath}/**/*.css`;
    } else {
      throw new Error('Bad config!');
    }

    try {
      const configFilePath = resolveCliPackagePath(
        `/bin/stylelint.config.${configType === EConfigType.ESM ? 'm' : 'c'}js`
      );

      const imports: Record<string, string> = {
        '{ objectMergeRight }': '@ladamczyk/qoq-utils',
      };

      const content: string[] = [];

      if ((<IModuleStylelintConfigWithTemplate>stylelint).template) {
        imports[`{ baseConfig }`] =
          `@ladamczyk/${(<IModuleStylelintConfigWithTemplate>stylelint).template}`;

        content.push(`const config = objectMergeRight(baseConfig, ${JSON.stringify(rest)})`);
      } else {
        content.push(`const config = ${JSON.stringify(rest)}`);
      }

      const exports = 'config';

      writeFileSync(configFilePath, formatCode(configType, imports, content, exports));

      this.configFile = resolveCwdRelativePath(configPath);

      if (files.length > 0) {
        let filteredFiles: string[];

        try {
          const ignores = await readIgnorePatterns(GITIGNORE_FILE_PATH);

          filteredFiles = files.filter((file) => !micromatch.isMatch(file, ignores));
        } catch {
          throw new Error();
        }

        if (filteredFiles.length === 0) {
          throw new TerminateExecutorGracefully();
        }

        this.targets = filteredFiles;
      } else {
        this.targets = [glob];
      }

      return super.prepare(args, options, files);
    } catch (e) {
      return this.handlePrepareError(e);
    }
  }

  // Lean JSON report for `--json`: drop stylelint's internal `_postcssResult`
  // blobs and keep only what summarize.mjs needs — per-file warnings, plus a
  // `fixable` flag derived from rule metadata (the json formatter omits it).
  private buildReport(result: LinterResult): TStylelintReport {
    const meta = result.ruleMetadata ?? {};

    return result.results.map((file) => ({
      source: file.source,
      warnings: file.warnings.map((warning) => ({
        line: warning.line,
        column: warning.column,
        rule: warning.rule,
        severity: warning.severity,
        text: warning.text,
        fixable: Boolean(meta[warning.rule]?.fixable),
      })),
    }));
  }
}
