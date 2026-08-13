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

// What prepare() resolves for execute(): stylelint runs through its JS API
// rather than a spawned binary, so there are no CLI args to carry this.
interface IStylelintContext {
  targets: string[];
  strict: boolean;
  configFile: string;
}

export class StylelintExecutor extends AbstractApiWithProgressExecutor<IStylelintContext> {
  static readonly CACHE_PATH = resolveCliRelativePath('/bin/.stylelintcache');

  protected getCommandName(): string {
    return 'stylelint';
  }

  protected getCachePath(): string {
    return StylelintExecutor.CACHE_PATH;
  }

  protected async execute(
    _args: string[],
    options: IExecutorOptions,
    { targets, strict, configFile }: IStylelintContext
  ): Promise<string | EExitCode> {
    const { default: stylelint } = await import('stylelint');

    const showProgress = this.showProgress(options);

    const result = await stylelint.lint({
      files: targets,
      // stylelint's `config` fully replaces `configFile` rather than merging
      // with it, so the progress plugin can only be added by loading the
      // generated config and appending to it — never both together.
      ...(showProgress ? { config: await this.getProgressConfig(configFile) } : { configFile }),
      fix: options.fix,
      cache: !options.disableCache,
      cacheLocation: StylelintExecutor.CACHE_PATH,
      cacheStrategy: 'metadata',
      formatter: 'string',
      allowEmptyInput: true,
      ...(strict ? { maxWarnings: 0 } : {}),
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
    _args: string[],
    _options: IExecutorOptions,
    files: string[] = []
  ): Promise<IStylelintContext> {
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

      // The template is pulled in through stylelint's own `extends` rather
      // than merged here: stylelint concatenates plugins/overrides and lets
      // the consumer's rules win, and resolving it by name keeps the
      // template's own extends/plugins rooted in the template package.
      const config =
        'template' in stylelint && stylelint.template
          ? {
              ...rest,
              extends: [`@ladamczyk/${stylelint.template}`, ...[rest.extends ?? []].flat()],
            }
          : rest;

      writeFileSync(
        configFilePath,
        formatCode(configType, {}, [`const config = ${JSON.stringify(config)}`], 'config')
      );

      return {
        strict: !!strict,
        configFile: resolveCwdRelativePath(configPath),
        targets: files.length > 0 ? await filterIgnored(files) : [glob],
      };
    } catch (e) {
      return this.handlePrepareError(e);
    }
  }

  // Stylelint's JS API exposes no per-file callback on `lint()`; a plugin
  // rule's `rule()` (invoked once per linted file, regardless of whether it
  // reports anything) is the only hook available. Loads the generated config
  // (rather than passing `configFile`, which `config` would otherwise
  // override wholesale) and appends the progress plugin to it.
  private async getProgressConfig(configFile: string): Promise<TStylelintApiConfig> {
    const { default: baseConfig } = (await import(pathToFileURL(configFile).toString())) as {
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

// Drops caller-supplied files that .gitignore covers. An unreadable ignore file
// is thrown bare so prepare()'s catch reports it as a config-load failure; every
// file being ignored is a graceful no-op, not an error.
const filterIgnored = async (files: string[]): Promise<string[]> => {
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

  return filteredFiles;
};
