// Self-contained resolver run by scripts/config-diff.js as a subprocess, once per package,
// once per tree (the current checkout and a `git worktree` checkout of another ref). It
// takes a package name and prints one JSON object of `{ [fixture]: snapshot }` to stdout.
//
// It is copied into the worktree and run there with `cwd` set to the worktree root, so it
// must not import anything outside this file — no shared helpers, nothing from the rest of
// this repo. `eslint` is resolved from `cwd`'s own node_modules, exactly like the file it's
// reading.
//
// `packages/<pkg>/eslint.config.local.js` is the seam that lets one resolver work on both
// sides of any migration to that file's export shape: it exists at the same path in every
// package on both sides, and this script never needs to know which side it's on.
// `[].concat(mod.default)` normalizes a single config object (e.g. legacy `baseConfig`) and
// a config array (e.g. composed `configs.base`) to the same array shape either way.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ESLint } from 'eslint';

// One resolved config per fixture per package — a single fixture hides every
// `files`-scoped difference between rule sets.
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

// The templates ship without `files` scoping (the qoq CLI adds it from qoq.config.js), and
// calculateConfigForFile returns undefined for a path no config's `files` matches.
const filesScope = { files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'] };

// ESLint's flat-config cascade keeps an earlier layer's rule options when a later layer
// overrides severity only, so a disabled rule's options carry no meaning — compare those on
// severity alone.
const normalizeRules = (rules) =>
  Object.fromEntries(
    Object.entries(rules ?? {}).map(([id, entry]) => {
      const tuple = Array.isArray(entry) ? entry : [entry];
      return [id, tuple[0] === 0 || tuple[0] === 'off' ? [0] : tuple];
    })
  );

const sortKeys = (obj) =>
  Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

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

  // `settings` (e.g. import-x resolver instances) can carry non-JSON-serializable members
  // (functions). Round-trip through JSON so the printed snapshot is always plain-JSON
  // comparable on the harness side.
  return JSON.parse(JSON.stringify(snapshot));
};

const packageName = process.argv[2];

if (!packageName) {
  console.error('Usage: node config-diff.resolver.mjs <package-name>');
  process.exit(1);
}

const localConfigPath = resolve(process.cwd(), 'packages', packageName, 'eslint.config.local.js');

if (!existsSync(localConfigPath)) {
  console.error(`${localConfigPath} does not exist.`);
  process.exit(1);
}

// eslint.config.local.js (on both sides of the migration) resolves lib/index.mjs via
// `resolve(__dirname, 'lib/index.mjs')`. It's a typeless .js file that Node promotes to a
// real ES module on sight of `export default` -- and real ESM has no `__dirname` binding, so
// a plain `import()` throws `ReferenceError: __dirname is not defined in ES module scope`
// here, and identically through ESLint's own config-loader (`eslint --config
// eslint.config.local.js` hits the same error). Bare identifiers in a module still resolve
// through the global object when nothing shadows them locally, so setting `__dirname` as a
// global for the duration of this one import gives the file what it expects without touching
// it -- it's outside this ticket's Files and shared with the pre-migration side.
globalThis.__dirname = resolve(process.cwd(), 'packages', packageName);

let mod;

try {
  mod = await import(pathToFileURL(localConfigPath).href);
} finally {
  delete globalThis.__dirname;
}

const configArray = [].concat(mod.default);

const snapshot = {};

for (const fixture of FIXTURES) {
  snapshot[fixture] = await resolveSnapshot(configArray, fixture);
}

process.stdout.write(JSON.stringify(snapshot));
