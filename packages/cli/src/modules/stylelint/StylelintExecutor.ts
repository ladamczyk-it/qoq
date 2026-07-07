/* eslint-disable sonarjs/cognitive-complexity */
import { writeFileSync } from 'fs';
import { relative } from 'path';
import { pathToFileURL } from 'url';

import { StylelintConfig } from '@ladamczyk/qoq-stylelint-css';
import { EExitCode, resolveCwdRelativePath } from '@ladamczyk/qoq-utils';
import micromatch from 'micromatch';

import { readIgnorePatterns } from '../../helpers/common.ts';
import { GITIGNORE_FILE_PATH } from '../../helpers/constants.ts';
import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { formatCode } from '../../helpers/formatCode.ts';
import { resolveCliPackagePath, resolveCliRelativePath } from '../../helpers/paths.ts';
import { EConfigType } from '../../helpers/types.ts';
import {
  AbstractApiWithProgressExecutor,
  PROGRESS_RULE_ID,
} from '../abstract/AbstractApiWithProgressExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import { EModulesStylelint } from './types.ts';

import type { Root } from 'postcss';
import type {
  Config as TStylelintApiConfig,
  LinterResult,
  Plugin,
  PostcssResult,
  Rule,
} from 'stylelint';

interface IStylelintReportWarning {
  line: number;
  column: number;
  rule: string;
  severity: string;
  text: string;
  fixable: boolean;
}

type TStylelintReport = { source: string | undefined; warnings: IStylelintReportWarning[] }[];

export class StylelintExecutor extends AbstractApiWithProgressExecutor {
  static readonly CACHE_PATH = resolveCliRelativePath('/bin/.stylelintcache');

  // Resolved in prepare(), consumed in execute() — stylelint runs through its JS
  // API rather than a spawned binary, so there are no CLI args to carry state.
  private targets: string[] = [];
  private strict = false;
  private configFile = '';

  protected getCommandName(): string {
    return 'stylelint';
  }

  protected async execute(_args: string[], options: IExecutorOptions): Promise<string | EExitCode> {
    const { default: stylelint } = await import('stylelint');

    const showProgress = this.showProgress(options);

    const result = await stylelint.lint({
      files: this.targets,
      // stylelint's `config` fully replaces `configFile` rather than merging
      // with it, so the progress plugin can only be added by loading the
      // generated config and appending to it — never both together.
      ...(showProgress
        ? { config: await this.getProgressConfig() }
        : { configFile: this.configFile }),
      fix: options.fix,
      cache: !options.disableCache,
      cacheLocation: StylelintExecutor.CACHE_PATH,
      cacheStrategy: 'metadata',
      formatter: 'string',
      allowEmptyInput: true,
      ...(this.strict ? { maxWarnings: 0 } : {}),
    });

    if (showProgress) {
      this.finishProgress(!result.errored && !result.maxWarningsExceeded);
    }

    if (options.json) {
      this.writeReport(this.buildReport(result), options.output);
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
    this.strict = !!strict;

    let rest: StylelintConfig;
    let glob: string;

    if ('pattern' in stylelint && stylelint.pattern) {
      const { pattern, ...other } = stylelint;

      rest = other;
      glob = pattern;
    } else if ('template' in stylelint && stylelint.template) {
      const { template, ...other } = stylelint;

      rest = other;
      glob =
        template === String(EModulesStylelint.STYLELINT_SCSS)
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

      if ('template' in stylelint && stylelint.template) {
        imports[`{ baseConfig }`] = `@ladamczyk/${stylelint.template}`;

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

  // Stylelint's JS API exposes no per-file callback on `lint()`; a plugin
  // rule's `rule()` (invoked once per linted file, regardless of whether it
  // reports anything) is the only hook available. Loads the generated config
  // (rather than passing `configFile`, which `config` would otherwise
  // override wholesale) and appends the progress plugin to it.
  private async getProgressConfig(): Promise<TStylelintApiConfig> {
    const { default: baseConfig } = (await import(pathToFileURL(this.configFile).toString())) as {
      default: TStylelintApiConfig;
    };

    const existingPlugins = baseConfig.plugins ? [baseConfig.plugins].flat() : [];

    // Never calls `result.warn()`, so it can't contribute to warning/error
    // counts. `ruleName`/`messages` are only required to satisfy stylelint's
    // `Rule` type; they're not read for a plugin rule that reports nothing.
    const progressRule: Rule = Object.assign(
      () => (_root: Root, result: PostcssResult) => {
        const file = result.opts.from;

        if (file) {
          this.printProgress(relative(process.cwd(), file));
        }
      },
      { ruleName: PROGRESS_RULE_ID, messages: {} }
    );

    const progressPlugin: Plugin = { ruleName: PROGRESS_RULE_ID, rule: progressRule };

    return {
      ...baseConfig,
      plugins: [...existingPlugins, progressPlugin],
      rules: { ...baseConfig.rules, [PROGRESS_RULE_ID]: true },
    };
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
