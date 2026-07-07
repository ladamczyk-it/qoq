#!/usr/bin/env node

import { existsSync, mkdirSync } from 'fs';

import { readPackage } from '@npmcli/package-json/lib/read-package';
import cac from 'cac';

import { PACKAGE_JSON_PATH } from './helpers/constants.ts';
import { resolveCliRelativePath } from './helpers/paths.ts';
import { getConfig, initConfig, execute } from './modules/index.ts';
import { IExecuteOptions, IExecuteStagedOptions } from './modules/types.ts';

import type { Command } from 'cac';

export const cli = cac('qoq');

// The default and `staged` commands accept the same cache + per-tool skip flags;
// register them once so a newly added tool's --skip-<tool> can't drift between them.
const withSkipOptions = (command: Command): Command =>
  command
    .option('--disable-cache', 'Bypass per-tool caches and force a full re-run')
    .option('--skip-npm', 'Skip npm dependency/package checks')
    .option('--skip-prettier', 'Skip Prettier formatting checks')
    .option('--skip-jscpd', 'Skip JSCPD copy-paste detection')
    .option('--skip-knip', 'Skip Knip unused-exports/dead-code checks')
    .option('--skip-eslint', 'Skip ESLint linting')
    .option('--skip-stylelint', 'Skip Stylelint CSS/SCSS linting')
    .option('--skip-structurelint', 'Skip Structurelint file/folder structure linting')
    .option('--skip-skillslint', 'Skip Skillslint skill-doc linting');

withSkipOptions(
  cli
    .command('[...tools]', 'Run quality checks (optionally filtered to named tools)')
    .option('--init', 'Scaffold a qoq.config.js in the current project')
    .option('--check', 'Run all enabled tools and report issues (exit 1 on findings)')
    .option('--fix', 'Re-run tools in fix mode to auto-correct issues where supported')
)
  .option('--warmup', 'Pre-generate tool configs in bin/ without running any checks')
  .option('--silent', 'Suppress all QoQ console output')
  .option('--config-hints', 'Print config suggestions alongside check results')
  .option('--production', 'Run tools in production mode (excludes dev-only rules)')
  .option('--json', "Write each tool's output to a JSON file in --output")
  .option('--output <path>', 'Directory for JSON reports (requires --json)', {
    default: resolveCliRelativePath('/bin/report'),
  })
  .option('--concurrency <type>', 'Run tools in parallel when possible. [off | auto]', {
    default: 'off',
  })
  .action(async (tools: string[], options: IExecuteOptions) => {
    const { workspaces } = (await readPackage(PACKAGE_JSON_PATH)) as { workspaces?: string[] };
    const { init, fix, disableCache, concurrency, json, output } = options;

    if (json && !existsSync(output)) {
      mkdirSync(output);
    }

    if (init) {
      return await initConfig(workspaces);
    }

    const config = await getConfig(workspaces);

    return await execute(
      config,
      {
        ...options,
        fix: !!fix,
        disableCache: !!disableCache,
        concurrency: concurrency ?? 'off',
      },
      undefined,
      tools.length ? tools : undefined
    );
  });

withSkipOptions(
  cli.command(
    'staged [...files]',
    'Run quality checks on a specific file list (e.g. for use with lint-staged)'
  )
)
  .option('--config-hints', 'Print config suggestions alongside check results')
  .option('--concurrency <type>', 'Run tools in parallel when possible. [off | auto]', {
    default: 'off',
  })
  // eslint-disable-next-line @typescript-eslint/default-param-last
  .action(async (files: string[] = [], options: IExecuteStagedOptions) => {
    const { workspaces } = (await readPackage(PACKAGE_JSON_PATH)) as { workspaces?: string[] };
    const { disableCache, concurrency } = options;
    const config = await getConfig(workspaces, true);

    return await execute(
      config,
      { ...options, fix: false, disableCache: !!disableCache, concurrency: concurrency ?? 'off' },
      files
    );
  });

cli.help();

// Skip auto-parsing when imported under Vitest so the command wiring can be
// exercised in isolation; the published bin still parses on startup.
if (!process.env.VITEST) {
  cli.parse();
}
