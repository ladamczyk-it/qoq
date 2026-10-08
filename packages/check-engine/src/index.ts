#!/usr/bin/env node

import { getPackageJson } from '@ladamczyk/qoq-utils';
import cac from 'cac';

import { checkEngine, type CheckOptions } from './helpers/checkEngine.ts';
import { fetchNodeInfo } from './helpers/fetchNodeInfo.ts';
import { findWorkspaces } from './helpers/findWorkspaces.ts';
import { buildReport, formatHuman } from './helpers/report.ts';

import type { IncludeFlag } from './helpers/types.ts';

export const cli = cac('check-engine');

const INCLUDE_FLAGS: readonly IncludeFlag[] = ['dev', 'peer', 'optional'];

cli
  .command('', 'Check Your engines.node config for project')
  .option('--include <list>', 'Also check dependency groups: dev, peer, optional (comma-separated)')
  .option('--no-lts', 'Skip the Node LTS lookup and its advisory')
  .option('--json', 'Write the report as JSON to stdout')
  .option('--quiet', 'Print nothing to stderr when every workspace passes')
  .action(async (options: { include?: string; lts?: boolean; json?: boolean; quiet?: boolean }) => {
    const requested = options.include?.split(',') ?? [];
    const bad = requested.find((value) => !INCLUDE_FLAGS.includes(value as IncludeFlag));

    if (bad !== undefined) {
      process.stderr.write(
        `Unknown --include value "${bad}"; allowed: ${INCLUDE_FLAGS.join(', ')}\n`
      );
      process.exitCode = 1;

      return;
    }

    const lts = options.lts === false ? null : await fetchNodeInfo('./node.json');
    const checkOptions: CheckOptions = { include: requested as IncludeFlag[], lts };
    const pathsToCheck = findWorkspaces(process.cwd(), getPackageJson()?.workspaces);
    const results = pathsToCheck.map((entry) => checkEngine(entry, checkOptions));

    const text = options.quiet ? formatHuman(results, { quiet: true }) : formatHuman(results);

    if (text !== '') {
      process.stderr.write(text);
    }

    if (options.json) {
      process.stdout.write(`${JSON.stringify(buildReport(results, lts), null, 2)}\n`);
    }

    if (results.some(({ status }) => status === 'fail')) {
      process.exitCode = 1;
    }
  });

cli.help();

// Skip auto-parsing when imported under Vitest so the command wiring can be
// exercised in isolation; the published bin still parses on startup.
if (!process.env.VITEST) {
  cli.parse();
}
