// Proves the defineConfig migration didn't change what ESLint actually resolves for
// consumers of the eslint-v9-* template packages.
//
// `capture` snapshots what ESLint resolves today from each package's legacy pre-merged
// export (baseConfig, and for eslint-v9-ts also testConfig/strictConfig), writing one
// JSON file per package under .config-baseline/. `compare` recomputes the same shape
// from the new defineConfig-composed export (configs.base/test/strict) and diffs it
// against the captured baseline.
//
// Both modes read packages/<pkg>/lib/index.mjs, so `npm run build` must have been run
// first — a package missing lib/index.mjs fails with a clear message below.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { ESLint } from 'eslint';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const BASELINE_DIR = resolve(REPO_ROOT, '.config-baseline');

// Every exported shape per package: eslint-v9-ts is the only one with test/strict layers.
const SHAPES_BY_PACKAGE = {
  'eslint-v9-js': ['base'],
  'eslint-v9-js-jest': ['base'],
  'eslint-v9-js-jest-rtl': ['base'],
  'eslint-v9-js-react': ['base'],
  'eslint-v9-js-vitest': ['base'],
  'eslint-v9-js-vitest-rtl': ['base'],
  'eslint-v9-ts': ['base', 'test', 'strict'],
  'eslint-v9-ts-jest': ['base'],
  'eslint-v9-ts-jest-rtl': ['base'],
  'eslint-v9-ts-react': ['base'],
  'eslint-v9-ts-vitest': ['base'],
  'eslint-v9-ts-vitest-rtl': ['base'],
};

const FIXTURES = [
  'src/example.js',
  'src/example.jsx',
  'src/example.mjs',
  'src/example.ts',
  'src/example.tsx',
  'src/example.spec.js',
  'src/example.spec.ts',
  'src/example.spec.tsx',
];

// The templates ship without `files` scoping (the qoq CLI adds it from qoq.config.js),
// and calculateConfigForFile returns undefined for a path no config's `files` matches.
const filesScope = { files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'] };

const LEGACY_EXPORT_NAME = { base: 'baseConfig', test: 'testConfig', strict: 'strictConfig' };

// Ticket 2.2 fixed a diamond-extends bug in eslint-v9-ts-react's `configs.base`: the
// legacy `baseConfig` merges the TS base on top of the React base, so objectMergeRight
// lets the JS base's plain tuples (riding in with tsBaseConfig) overwrite `reactLayer`'s
// React-specific *option* overrides on exactly these two rules. The composed chain never
// re-applies the JS base, so it keeps them — a real, sanctioned improvement, not a bug in
// this oracle. Severities are unchanged on both sides and still compared below; only
// options diverge, and only ever composed-has-more. Same decision as
// packages/eslint-v9-ts-react/src/configs.spec.ts's `SANCTIONED_OPTION_DELTAS`.
// Milestone 4 deletes both the legacy `baseConfig` export and this allow-list — do not
// extend it for any other package or rule.
const SANCTIONED_OPTION_DELTAS = {
  'eslint-v9-ts-react': {
    'import-x/order': 'react* path group',
    'no-restricted-imports': 'lodash/debounce',
  },
};

// ESLint's flat-config cascade keeps an earlier layer's rule options when a later layer
// overrides severity only, whereas the objectMergeRight deep-merge this migration
// replaces used to replace the whole tuple. Options carry no meaning on a disabled rule,
// so those entries compare on severity alone. Same normalization as
// packages/eslint-v9-ts-vitest/src/configs.spec.ts.
const normalizeRules = (rules) =>
  Object.fromEntries(
    Object.entries(rules ?? {}).map(([id, entry]) => {
      const tuple = Array.isArray(entry) ? entry : [entry];
      return [id, tuple[0] === 0 || tuple[0] === 'off' ? [0] : tuple];
    })
  );

const sortKeys = (obj) =>
  Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

const libPath = (packageName) => resolve(REPO_ROOT, 'packages', packageName, 'lib', 'index.mjs');

const loadPackageModule = async (packageName) => {
  const path = libPath(packageName);

  if (!existsSync(path)) {
    throw new Error(
      `packages/${packageName}/lib/index.mjs is missing — run \`npm run build\` first.`
    );
  }

  return import(`${path}?t=${Date.now()}`);
};

const resolveSnapshot = async (overrideConfigArray, fixturePath) => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [...overrideConfigArray, filesScope],
    cwd: process.cwd(),
  });
  const resolved = await eslint.calculateConfigForFile(fixturePath);

  if (!resolved) {
    throw new Error(`calculateConfigForFile resolved nothing for ${fixturePath}`);
  }

  const snapshot = {
    rules: sortKeys(normalizeRules(resolved.rules)),
    plugins: Object.keys(resolved.plugins ?? {}).sort(),
    settings: resolved.settings ?? {},
    linterOptions: resolved.linterOptions ?? {},
    languageOptions: {
      ecmaVersion: resolved.languageOptions?.ecmaVersion,
      sourceType: resolved.languageOptions?.sourceType,
      globals: Object.keys(resolved.languageOptions?.globals ?? {}).sort(),
      parserOptions: resolved.languageOptions?.parserOptions ?? {},
      parser: resolved.languageOptions?.parser?.meta?.name ?? null,
    },
  };

  // `settings` (e.g. import-x resolver instances) can carry non-JSON-serializable
  // members (functions). Round-trip through JSON so the in-memory snapshot always
  // matches what capture wrote to disk and what compare reads back.
  return JSON.parse(JSON.stringify(snapshot));
};

// { [shape]: { [fixture]: snapshot } }, built for every fixture x shape of one package.
const buildPackageSnapshot = async (packageName, shapes, getConfigArray) => {
  const snapshot = {};

  for (const shape of shapes) {
    const overrideConfigArray = getConfigArray(shape);

    if (!overrideConfigArray) {
      snapshot[shape] = { __missingExport: true };
      continue;
    }

    snapshot[shape] = {};

    for (const fixture of FIXTURES) {
      snapshot[shape][fixture] = await resolveSnapshot(overrideConfigArray, fixture);
    }
  }

  return snapshot;
};

const capture = async () => {
  mkdirSync(BASELINE_DIR, { recursive: true });

  for (const [packageName, shapes] of Object.entries(SHAPES_BY_PACKAGE)) {
    const mod = await loadPackageModule(packageName);
    const snapshot = await buildPackageSnapshot(packageName, shapes, (shape) => {
      const exportName = LEGACY_EXPORT_NAME[shape];
      const legacyConfig = mod[exportName];

      if (!legacyConfig) {
        throw new Error(`packages/${packageName}/lib/index.mjs has no export \`${exportName}\``);
      }

      return [legacyConfig];
    });

    writeFileSync(
      resolve(BASELINE_DIR, `${packageName}.json`),
      `${JSON.stringify(snapshot, null, 2)}\n`
    );
  }

  console.log(`Captured baselines for ${Object.keys(SHAPES_BY_PACKAGE).length} packages.`);
};

const diffValues = (label, baselineValue, currentValue, issues) => {
  if (!isDeepStrictEqual(baselineValue, currentValue)) {
    issues.push({ label, baselineValue, currentValue });
  }
};

const diffSnapshot = (
  context,
  baselineSnapshot,
  currentSnapshot,
  issues,
  sanctionedRules,
  expectedDeltas
) => {
  const ruleIds = new Set([
    ...Object.keys(baselineSnapshot.rules ?? {}),
    ...Object.keys(currentSnapshot.rules ?? {}),
  ]);

  for (const ruleId of ruleIds) {
    const baselineRule = baselineSnapshot.rules?.[ruleId];
    const currentRule = currentSnapshot.rules?.[ruleId];

    // A sanctioned rule still fails on a severity change — only its options are waived,
    // and only when they actually differ (a re-capture that already matches needs no
    // waiver).
    if (sanctionedRules?.[ruleId] && !isDeepStrictEqual(baselineRule, currentRule)) {
      if (baselineRule?.[0] !== currentRule?.[0]) {
        issues.push({
          label: `${context} rule=${ruleId}`,
          baselineValue: baselineRule,
          currentValue: currentRule,
        });
      } else {
        expectedDeltas.add(ruleId);
      }

      continue;
    }

    diffValues(`${context} rule=${ruleId}`, baselineRule, currentRule, issues);
  }

  for (const key of ['plugins', 'settings', 'linterOptions', 'languageOptions']) {
    diffValues(`${context} key=${key}`, baselineSnapshot[key], currentSnapshot[key], issues);
  }
};

const compare = async () => {
  let hasFailures = false;

  for (const [packageName, shapes] of Object.entries(SHAPES_BY_PACKAGE)) {
    const baselinePath = resolve(BASELINE_DIR, `${packageName}.json`);

    if (!existsSync(baselinePath)) {
      hasFailures = true;
      console.error(
        `FAIL ${packageName}: no baseline at .config-baseline/${packageName}.json — run \`capture\` first.`
      );
      continue;
    }

    const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
    const mod = await loadPackageModule(packageName);
    const issues = [];
    const expectedDeltas = new Set();
    const sanctionedRules = SANCTIONED_OPTION_DELTAS[packageName];
    let missingExport = false;

    for (const shape of shapes) {
      const composedConfig = mod.configs?.[shape];

      if (!composedConfig) {
        missingExport = true;
        hasFailures = true;
        console.error(`FAIL ${packageName}: no \`configs.${shape}\` export yet (not composed).`);
        continue;
      }

      for (const fixture of FIXTURES) {
        const currentSnapshot = await resolveSnapshot(composedConfig, fixture);
        const baselineSnapshot = baseline[shape]?.[fixture];

        if (!baselineSnapshot) {
          issues.push({
            label: `export=${shape} fixture=${fixture}`,
            baselineValue: undefined,
            currentValue: '<no baseline entry>',
          });
          continue;
        }

        diffSnapshot(
          `export=${shape} fixture=${fixture}`,
          baselineSnapshot,
          currentSnapshot,
          issues,
          sanctionedRules,
          expectedDeltas
        );
      }
    }

    if (issues.length > 0) {
      hasFailures = true;

      for (const issue of issues) {
        console.error(`DIFF ${packageName} ${issue.label}`);
        console.error(`  baseline: ${JSON.stringify(issue.baselineValue)}`);
        console.error(`  current:  ${JSON.stringify(issue.currentValue)}`);
      }
    }

    if (!missingExport && issues.length === 0) {
      const deltaSuffix =
        expectedDeltas.size > 0
          ? ` (${expectedDeltas.size} expected delta${expectedDeltas.size === 1 ? '' : 's'})`
          : '';

      console.log(`OK   ${packageName}${deltaSuffix}`);

      for (const ruleId of expectedDeltas) {
        console.log(`     ${ruleId.padEnd(22)}${sanctionedRules[ruleId]}`);
      }
    }
  }

  if (hasFailures) {
    process.exit(1);
  }
};

const mode = process.argv[2];

if (mode === 'capture') {
  await capture();
} else if (mode === 'compare') {
  await compare();
} else {
  console.error('Usage: node ./scripts/config-baseline.js <capture|compare>');
  process.exit(1);
}
