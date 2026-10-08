#!/usr/bin/env node

import { getPackageJson } from '@ladamczyk/qoq-utils';
import cac from 'cac';

import { checkEngine, type CheckOptions } from './helpers/checkEngine.ts';
import { findWorkspaces } from './helpers/findWorkspaces.ts';
import { formatHuman } from './helpers/report.ts';

import type { IncludeFlag } from './helpers/types.ts';

export const cli = cac('check-engine');

const INCLUDE_FLAGS: readonly IncludeFlag[] = ['dev', 'peer', 'optional'];

cli
  .command('', 'Check Your engines.node config for project')
  .option('--include <list>', 'Also check dependency groups: dev, peer, optional (comma-separated)')
  .action((options: { include?: string }) => {
    const requested = options.include?.split(',') ?? [];
    const bad = requested.find((value) => !INCLUDE_FLAGS.includes(value as IncludeFlag));

    if (bad !== undefined) {
      process.stderr.write(
        `Unknown --include value "${bad}"; allowed: ${INCLUDE_FLAGS.join(', ')}\n`
      );
      process.exitCode = 1;

      return;
    }

    const checkOptions: CheckOptions | undefined =
      options.include === undefined
        ? undefined
        : { include: requested as IncludeFlag[], lts: null };
    const pathsToCheck = findWorkspaces(process.cwd(), getPackageJson()?.workspaces);

    const results = pathsToCheck.map((entry) =>
      checkOptions ? checkEngine(entry, checkOptions) : checkEngine(entry)
    );

    process.stderr.write(formatHuman(results));

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
