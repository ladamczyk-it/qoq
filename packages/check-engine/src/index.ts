#!/usr/bin/env node

import { getPackageJson } from '@ladamczyk/qoq-utils';
import cac from 'cac';

import { checkEngine } from './helpers/checkEngine.ts';
import { findWorkspaces } from './helpers/findWorkspaces.ts';
import { formatHuman } from './helpers/report.ts';

export const cli = cac('check-engine');

cli.command('', 'Check Your engines.node config for project').action(() => {
  const pathsToCheck = findWorkspaces(process.cwd(), getPackageJson()?.workspaces);

  const results = pathsToCheck.map((entry) => checkEngine(entry));

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
