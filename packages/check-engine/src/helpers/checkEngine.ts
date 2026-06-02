/* eslint-disable sonarjs/cognitive-complexity */
import { getPackageInfo } from '@ladamczyk/qoq-utils';
import c from 'picocolors';
import { valid, SemVer, validRange, Range } from 'semver';

import { readJsonSync } from './readJson.ts';

import type { PackageJson } from 'type-fest';

export const checkEngine = (path: string, workspaces: boolean = false): void => {
  if (workspaces) {
    process.stderr.write(c.blue(`Checking '${path}':\n\n`));
  }

  const { dependencies, devDependencies, engines } = readJsonSync<PackageJson>(path);
  const nodeConfigured = engines?.node;

  if (nodeConfigured) {
    process.stderr.write(c.green('Found engines.node config:\n'));
    process.stderr.write(`${nodeConfigured}\n\n`);

    try {
      valid(nodeConfigured);
    } catch {
      try {
        validRange(nodeConfigured);
      } catch {
        process.stderr.write(c.red(`Bad engines.node version!\n`));

        process.exit(1);
      }
    }
  }

  const dependenciesKeys = Object.keys(new Object(dependencies));

  if (dependenciesKeys.length === 0) {
    process.stderr.write(
      c.yellow('No dependencies found, checking engines also from devDependencies.\n\n')
    );
  }

  const dependenciesList =
    dependenciesKeys.length > 0 ? dependenciesKeys : [...Object.keys(new Object(devDependencies))];

  const enginesRaw = dependenciesList.reduce((acc: string[], dependency) => {
    const { packageJson } = getPackageInfo(dependency);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const enginesNode = String(packageJson?.engines?.node ?? '');

    if (enginesNode && !acc.includes(enginesNode)) {
      acc.push(enginesNode);
    }

    return acc;
  }, []);

  if (enginesRaw.length > 0) {
    process.stderr.write(c.green('Needed engines.node config:\n'));
    process.stderr.write(`${JSON.stringify(enginesRaw, undefined, 2)}\n\n`);
  } else {
    process.stderr.write(
      c.yellow(
        'No dependencies or devDependencies found, set engines based only on Your project.\n'
      )
    );
  }

  if (nodeConfigured) {
    try {
      const nodeVersion = new SemVer(nodeConfigured);

      if (enginesRaw.some((versionString: string) => new Range(versionString).test(nodeVersion))) {
        process.stderr.write(c.red('Your engines.node does not match dependencies criteria!.\n'));

        process.exit(1);
      } else {
        process.stderr.write(c.blue('Configured correctly!\n\n'));
      }
    } catch {
      const nodeRange = new Range(nodeConfigured);

      if (
        enginesRaw.some((versionString: string) => !nodeRange.intersects(new Range(versionString)))
      ) {
        process.stderr.write(c.red('Your engines.node does not match dependencies criteria!.\n'));

        process.exit(1);
      } else {
        process.stderr.write(c.blue('Configured correctly!\n\n'));
      }
    }
  } else if (!nodeConfigured) {
    process.stderr.write(
      c.yellow('No engines.node configured, You should add it to ensure node complience.\n')
    );
  }

  process.stderr.write('--------------------------------\n\n');
};
