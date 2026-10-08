#!/usr/bin/env node

import { existsSync, readdirSync } from 'node:fs';

import { getPackageJson, getRelativePath, resolveCwdPath } from '@ladamczyk/qoq-utils';
import cac from 'cac';

import { checkEngine } from './helpers/checkEngine.ts';
import { formatHuman } from './helpers/report.ts';

export const cli = cac('check-engine');

cli.command('', 'Check Your engines.node config for project').action(() => {
  const packageJson = getPackageJson();
  const workspaces = (packageJson?.workspaces as string[]) ?? [];
  const pathsToCheck: string[] = [
    './package.json',
    ...(workspaces ?? []).reduce((acc: string[], current) => {
      if (!current.includes('*')) {
        acc.push(current);
      } else {
        const path = `/${current.replaceAll('*', '')}`;

        return acc.concat(
          readdirSync(resolveCwdPath(path), { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .filter(({ parentPath, name }) =>
              existsSync(getRelativePath(`${parentPath}/${name}/package.json`))
            )
            .map(({ parentPath, name }) => {
              return getRelativePath(`${parentPath}/${name}/package.json`);
            })
        );
      }

      return acc;
    }, []),
  ];

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
