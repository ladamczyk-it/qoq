// Reads a feature from disk for the CLIs: the parent folder's feature.json, the
// BRD, and each repo's plan index. These are the texts `featureState` takes. The
// hooks module reads the same files through its own `$.fs`.
//
// Exits 1 with the reason on stderr when an argument, feature.json or the BRD is
// missing or unreadable.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { repoPlans } from './feature-state.mjs';

export const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined);

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

// `--root <parent folder> --feature <slug>`, from argv.
export const loadFeature = (args = process.argv.slice(2)) => {
  const flag = (name) => {
    const at = args.indexOf(`--${name}`);
    return at === -1 ? undefined : args[at + 1];
  };
  const root = resolve(flag('root') ?? process.cwd());
  const slug = flag('feature');
  if (!slug) {
    fail('--feature <slug> is required');
  }

  const featureFile = read(join(root, 'feature.json'));
  if (featureFile === undefined) {
    fail(`no feature.json in ${root}`);
  }
  let feature;
  try {
    feature = JSON.parse(featureFile);
  } catch (error) {
    fail(`feature.json is not valid JSON: ${error.message}`);
  }

  const brdPath = join(root, 'feature', slug, 'brd.md');
  const brd = read(brdPath);
  if (brd === undefined) {
    fail(`no BRD at ${brdPath}`);
  }

  const plans = repoPlans(brd);
  const indexes = Object.fromEntries(
    (feature.repos ?? []).map((repo) => [
      repo.name,
      plans.has(repo.name) && plans.get(repo.name) !== 'none'
        ? read(join(root, repo.path, plans.get(repo.name), 'index.md'))
        : undefined,
    ])
  );
  return { root, slug, feature, brd, plans, indexes };
};
