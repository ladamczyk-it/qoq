import { existsSync, writeFileSync } from 'fs';
import { relative } from 'path';
import { pathToFileURL } from 'url';

import { EExitCode, resolveCwdRelativePath } from '@ladamczyk/qoq-utils';
import micromatch from 'micromatch';

import { GITIGNORE_FILE_PATH } from '../../helpers/constants.ts';
import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { formatCode } from '../../helpers/formatCode.ts';
import { resolveCliPackagePath, resolveCliRelativePath, toPosix } from '../../helpers/paths.ts';
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
    // templates that bring in `eslint`); kept external in rolldown.config.js.
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
        configPaths: { eslint: configPath },
      } = this.modulesConfig;
      const configFilePath = resolveCliPackagePath(
        `/bin/eslint.config.${configType === EConfigType.ESM ? 'm' : 'c'}js`
      );

      this.writeGeneratedConfig(configFilePath);

      this.configFile = resolveCwdRelativePath(configPath);
      this.targets = await this.resolveTargets(configFilePath, files);

      return super.prepare(args, options, files);
    } catch (e) {
      return this.handlePrepareError(e);
    }
  }

  // Renders the consumer's eslint.config.{mjs,cjs} as generated source text (an
  // `imports` record, a `content` array of `const config<N> = [...]` lines, and an
  // `exports` expression) and writes it via formatCode().
  private writeGeneratedConfig(configFilePath: string): void {
    const { configType, modules, workspaces } = this.modulesConfig;

    const imports: Record<string, string> = {
      '{ defineConfig }': 'eslint/config',
      '{ includeIgnoreFile }': '@eslint/compat',
    };

    // The templates default `import-x/no-cycle` to `ignoreExternal: true` (skips
    // ~98% of its cost — see benchmark). But "external" is resolved per-package
    // (nearest package.json), so in a monorepo a sibling workspace package looks
    // just as external as a real node_modules dependency, and cross-package
    // cycles would go undetected. Restore full cycle detection whenever the
    // consumer's package.json declares workspaces; an explicit user override in
    // qoq.config.js's `rules` still wins, since the user's block is the config
    // object doing the extending and defineConfig places it after everything it
    // extends.
    const monorepoNoCycleOverride = JSON.stringify({
      rules: { 'import-x/no-cycle': [1, { ignoreExternal: false }] },
    });

    // Every qoq-eslint-v9-ts* template calls createTypeScriptImportResolver() with no
    // `project` option, so it falls back to `<root>/tsconfig.json` — and unlike tsc, it
    // never walks up from the linted file to find a nearer one. In a monorepo, per-package
    // path aliases (declared in each package's own tsconfig.json `paths`) are therefore
    // invisible to it, and imports using them misreport as import-x/no-unresolved even
    // though tsc resolves them fine. Point the resolver at every workspace's tsconfig (plus
    // the root, for any TS file living outside a workspace package) whenever the consumer's
    // package.json declares workspaces; an explicit user override in qoq.config.js's
    // `rules`/`settings` still wins, since it applies last (see above). Passing >1 project path is
    // deliberate here, so suppress the resolver's own "Multiple projects found" warning —
    // it only knows the single-project-with-references case is fast, not that this one is fine.
    const monorepoResolverOverride = (consumerWorkspaces: string[]): string =>
      `{ settings: { 'import-x/resolver-next': [createTypeScriptImportResolver({ project: ${JSON.stringify(
        [...consumerWorkspaces.map((workspace) => `${workspace}/tsconfig.json`), 'tsconfig.json']
      )}, noWarnOnMultipleProjects: true }), createNodeResolver()] } }`;

    const content = (modules?.eslint ?? []).reduce(
      (acc: string[], current: IModuleEslintConfig, index) => {
        const { template, ...rest } = current;

        if (!Object.values(EModulesEslint).includes(template as EModulesEslint)) {
          acc.push(`const config${index} = [${JSON.stringify(rest)}]`);

          return acc;
        }

        imports[this.buildTemplateImportKey(configType, 'configs', `configs${index}`)] =
          `@ladamczyk/${template}`;

        const usesResolverOverride =
          Boolean(workspaces?.length) && (template?.startsWith('qoq-eslint-v9-ts') ?? false);

        if (usesResolverOverride) {
          // Through the TS base config, which every qoq-eslint-v9-ts* template inherits
          // from and which declares the resolvers. Importing them directly would make the
          // generated config depend on packages the consumer never declares, so it breaks
          // as soon as npm nests them instead of hoisting.
          imports['{ createTypeScriptImportResolver, createNodeResolver }'] =
            `@ladamczyk/${EModulesEslint.ESLINT_V9_TS}`;
        }

        // The template's `configs.base` is a flat-config array, so it's extended rather
        // than pre-merged: defineConfig expands the `extends` list in order, scopes every
        // extended entry to the user block's `files`/`ignores`, and appends the user block
        // itself last — same precedence the objectMergeRight chain used to produce
        // (base < no-cycle override < resolver override < user's qoq.config.js block).
        const extendsArgs = [
          `configs${index}.base`,
          ...(workspaces?.length ? [monorepoNoCycleOverride] : []),
          ...(usesResolverOverride ? [monorepoResolverOverride(workspaces as string[])] : []),
        ];

        acc.push(
          `const config${index} = defineConfig({ extends: [${extendsArgs.join(
            ', '
          )}], ...${JSON.stringify(rest)} })`
        );

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
  }

  // The two destructuring shapes formatCode() expects for a template's named export:
  // `{ x as y }` renders as `import { x as y } from …` (ESM), `{ x: y }` as
  // `const { x: y } = require(…)` (CJS).
  private buildTemplateImportKey(
    configType: EConfigType,
    exportedName: string,
    localAlias: string
  ): string {
    return configType === EConfigType.ESM
      ? `{ ${exportedName} as ${localAlias} }`
      : `{ ${exportedName}: ${localAlias} }`;
  }

  private async resolveTargets(configFilePath: string, files: string[]): Promise<string[]> {
    // No explicit files: mirror the CLI's no-pattern default of linting the cwd
    // and letting the flat config's own `files`/`ignores` decide the scope.
    if (files.length === 0) {
      return ['.'];
    }

    let eslintConfig: { default: IModuleEslintConfig[] };

    try {
      eslintConfig = (await import(pathToFileURL(configFilePath).toString())) as {
        default: IModuleEslintConfig[];
      };
    } catch (cause) {
      throw new Error(`Failed to import the generated ESLint config at ${configFilePath}`, {
        cause,
      });
    }

    const possibleFiles = eslintConfig.default.map((config) => ({
      files: prepareCollection(config.files as string[] | undefined),
      ignores: prepareCollection(config.ignores),
    }));

    const shouldLintFile = (file: string) =>
      possibleFiles.some(
        ({ files: filesPatterns, ignores: ignoresPatterns }) =>
          micromatch.isMatch(file, filesPatterns) && !micromatch.isMatch(file, ignoresPatterns)
      );

    const filteredFiles = files.filter((file) => shouldLintFile(file));

    if (filteredFiles.length === 0) {
      throw new TerminateExecutorGracefully();
    }

    return filteredFiles;
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

const mapCallback = (entry: string): string =>
  entry.startsWith('**') || entry.startsWith('./') ? entry : `**/${entry}`;

// `patterns` is genuinely `string[] | undefined` (an entry's `files`/`ignores`
// may be omitted); the guard keeps the undefined case at `[]` rather than the
// `[undefined]` a bare `[patterns].flat(Infinity)` would produce.
const prepareCollection = (patterns: string[] | undefined): string[] =>
  (patterns ? ([patterns].flat(Infinity) as string[]) : []).map(mapCallback);
