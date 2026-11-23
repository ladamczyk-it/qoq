// node --test scripts/website.node-test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');
const STAMP = /verified against \*\*`[^`]*` v[0-9.]*/g;

test('the docs index carries exactly one stamp, at the root version', () => {
  const stamps = read('website/docs/index.mdx').match(STAMP);

  const { version } = JSON.parse(read('package.json'));

  assert.deepEqual(stamps, [`verified against **\`@ladamczyk/qoq\` v${version}`]);
});

test('website/package.json is written the way mergePackageJson writes it', () => {
  const raw = read('website/package.json');
  const pkg = JSON.parse(raw);
  for (const block of ['dependencies', 'devDependencies']) {
    pkg[block] = Object.fromEntries(
      Object.entries(pkg[block]).sort(([a], [b]) => a.localeCompare(b, 'en'))
    );
  }

  assert.equal(JSON.stringify(pkg, null, 2) + '\n', raw);
  assert.equal(pkg.name, 'qoq-website');
  assert.equal(pkg.dependencies['@docusaurus/theme-common'], pkg.dependencies['@docusaurus/core']);
});

test('the root description is the README bold opener', () => {
  const opener = read('README.md').match(/^\*\*(A streamlined suite.*)\*\*$/m)[1];

  assert.equal(JSON.parse(read('package.json')).description, opener);
});
