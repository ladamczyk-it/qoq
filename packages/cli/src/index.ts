#!/usr/bin/env node

import { existsSync, mkdirSync } from 'fs';
import { relative } from 'path';

import { readPackage } from '@npmcli/package-json/lib/read-package';
import cac from 'cac';

import { PACKAGE_JSON_PATH } from './helpers/constants.ts';
import { resolveCliRelativePath, toPosix } from './helpers/paths.ts';
import { getConfig, initConfig, execute, scan } from './modules/index.ts';
import { IExecuteOptions, IExecuteStagedOptions } from './modules/types.ts';

import type { Command } from 'cac';

export const cli = cac('qoq');

// CI runners set CI=true by convention; treat that the same as --silent to
// keep CI logs short unless the user explicitly opted into verbose output.
const isCi = (): boolean => process.env.CI === 'true';

// The default and `staged` commands accept the same cache + per-tool skip flags;
// register them once so a newly added tool's --skip-<tool> can't drift between them.
const withCommonOptions = (command: Command): Command =>
  command
    .option('--disable-cache', 'Bypass per-tool caches and force a full re-run')
    // cac defaults `configHints` to true once a `--no-` form is declared.
    .option('--no-config-hints', 'Hide Knip config suggestions printed alongside check results')
    .option('--concurrency <type>', 'Run tools in parallel when possible. [off | auto]', {
      default: 'off',
    })
    .option('--skip-npm', 'Skip npm dependency/package checks')
    .option('--skip-prettier', 'Skip Prettier formatting checks')
    .option('--skip-jscpd', 'Skip JSCPD copy-paste detection')
    .option('--skip-knip', 'Skip Knip unused-exports/dead-code checks')
    .option('--skip-eslint', 'Skip ESLint linting')
    .option('--skip-stylelint', 'Skip Stylelint CSS/SCSS linting')
    .option('--skip-structurelint', 'Skip Structurelint file/folder structure linting')
    .option('--skip-skillslint', 'Skip Skillslint skill-doc linting')
    .option('--skip-justify-disable', 'Skip Justify-disable lint-disable justification check')
    .option('--silent', 'Suppress all QoQ console output')
    .option('--json', "Write each tool's output to a JSON file in --output")
    .option('--output <path>', 'Directory for JSON reports (requires --json)', {
      default: resolveCliRelativePath('/bin/report'),
    });

// cac 7.1.0 lists boolean flags for mri under their camelCase name while mri
// sees `--skip-knip`, so the flag swallows the next positional as its value —
// the first file lint-staged appends. Handing mri the camelCase spelling fixes it.
export const camelFlags = (argv: string[]): string[] =>
  argv.map((arg) =>
    arg.replace(
      /^--([a-z]+(?:-[a-z]+)+)$/,
      (_, name: string) =>
        `--${name.replace(/-([a-z])/g, (__, char: string) => char.toUpperCase())}`
    )
  );

withCommonOptions(
  cli
    .command('[...tools]', 'Run quality checks (optionally filtered to named tools)')
    .option('--init', 'Scaffold a qoq.config.js in the current project')
    .option('--check', 'Run all enabled tools and report issues (exit 1 on findings)')
    .option('--fix', 'Re-run tools in fix mode to auto-correct issues where supported')
)
  .option('--warmup', 'Pre-generate tool configs in bin/ without running any checks')
  .option('--production', 'Run tools in production mode (excludes dev-only rules)')

  .action(async (tools: string[], options: IExecuteOptions) => {
    const { workspaces } = (await readPackage(PACKAGE_JSON_PATH)) as { workspaces?: string[] };
    const { init, fix, disableCache, concurrency, json, output } = options;

    if (json && !existsSync(output)) {
      mkdirSync(output);
    }

    if (init) {
      return await initConfig(workspaces);
    }

    // --warmup (IDE) and CI are non-interactive: never fall into the setup wizard.
    const config = await getConfig(workspaces, !!options.warmup || isCi());

    return await execute(
      config,
      {
        ...options,
        fix: !!fix,
        disableCache: !!disableCache,
        concurrency: concurrency ?? 'off',
        silent: !!options.silent || isCi(),
        ci: isCi(),
      },
      undefined,
      tools.length ? tools : undefined
    );
  });

withCommonOptions(
  cli.command(
    'staged [...files]',
    'Run quality checks on a specific file list (e.g. for use with lint-staged)'
  )
)
  // eslint-disable-next-line @typescript-eslint/default-param-last
  .action(async (files: string[] = [], options: IExecuteStagedOptions) => {
    // Nothing to check is not a failure: say so and exit 0 rather than
    // silently widening the run to the whole repo.
    if (files.length === 0) {
      process.stdout.write(
        'No files given, nothing to check. Pass the file list, e.g. via lint-staged.\n'
      );

      return;
    }

    // lint-staged hands over absolute paths; every tool matches its globs
    // against cwd-relative ones.
    const targets = files.map((file) => toPosix(relative(process.cwd(), file)));

    const { workspaces } = (await readPackage(PACKAGE_JSON_PATH)) as { workspaces?: string[] };
    const { disableCache, concurrency, json, output } = options;

    if (json) {
      mkdirSync(output, { recursive: true });
    }

    const config = await getConfig(workspaces, true);

    return await execute(
      config,
      {
        ...options,
        fix: false,
        disableCache: !!disableCache,
        concurrency: concurrency ?? 'off',
        silent: !!options.silent || isCi(),
        ci: isCi(),
      },
      targets
    );
  });

cli
  .command('scan', 'Scan dependencies for known vulnerabilities (OSV.dev by default)')
  .option('--json', 'Write the scan report to a JSON file in --output')
  .option('--output <path>', 'Directory for JSON reports (requires --json)', {
    default: resolveCliRelativePath('/bin/report'),
  })
  .option('--timeout <ms>', 'Abort the scan after this many milliseconds')
  .option('--production', 'Scan production dependencies only')
  .option('--graph', 'Print the dependency paths from each finding up to your package.json files')
  .option('--silent', 'Suppress all QoQ console output')
  .action(async (options: IExecuteStagedOptions & { timeout?: number | string }) => {
    const config = await getConfig(undefined, true);

    if (options.json) {
      mkdirSync(options.output, { recursive: true });
    }

    return await scan(
      config,
      { ...options, fix: false, disableCache: false, concurrency: 'off', silent: !!options.silent },
      options.timeout === undefined ? undefined : Number(options.timeout)
    );
  });

cli.help();

// Skip auto-parsing when imported under Vitest so the command wiring can be
// exercised in isolation; the published bin still parses on startup.
if (!process.env.VITEST) {
  cli.parse(camelFlags(process.argv));
}
