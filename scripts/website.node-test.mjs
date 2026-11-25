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
  assert.equal(pkg.dependencies['@docusaurus/theme-mermaid'], pkg.dependencies['@docusaurus/core']);
});

test('the root description is the README bold opener', () => {
  const opener = read('README.md').match(/^\*\*(A streamlined suite.*)\*\*$/m)[1];

  assert.equal(JSON.parse(read('package.json')).description, opener);
});

test('.gitignore ends on the un-ignore of website/.npmrc and ignores the config-inspector report', () => {
  const lines = read('.gitignore')
    .split('\n')
    .filter((line) => line.trim() !== '');

  assert.equal(lines.at(-1), '!website/.npmrc');
  assert.ok(lines.includes('website/static/config-inspector'));
});

test('CLAUDE.md holds one docs-site block whose release bullet names master', () => {
  const claude = read('CLAUDE.md');

  assert.equal(claude.match(/<!-- docs-site -->/g)?.length, 1);
  assert.equal(claude.match(/<!-- \/docs-site -->/g)?.length, 1);
  const block = claude.slice(
    claude.indexOf('<!-- docs-site -->'),
    claude.indexOf('<!-- /docs-site -->')
  );
  assert.match(block, /Every release tag pushes[^\n]*to `master`/);
});

test('qoq.config.js lints the website through qoq.website.js and knips its workspace', () => {
  const config = read('qoq.config.js');

  assert.match(config, /import \{ websiteEslint \} from '\.\/qoq\.website\.js'/);
  assert.match(config, /\.\.\.websiteEslint/);
  assert.match(config, /ignoreDependencies: \['@internal\/docusaurus-theme-docusaurus-theme'\]/);
});

test('ConfigInspector has no temporary knip ignores and exports no IInspectorVariant', () => {
  const config = read('qoq.config.js');

  assert.doesNotMatch(config, /website\/src\/components\/ConfigInspector/);
  assert.doesNotMatch(config, /@docusaurus\/theme-common/);
  assert.doesNotMatch(
    read('website/src/components/ConfigInspector/variants.ts'),
    /export (interface|type) IInspectorVariant/
  );
});

test('.templateignore lists the template FILES plus package.json, one per line', () => {
  assert.equal(
    read('.templateignore'),
    [
      'tsconfig.json',
      'commitlint.config.js',
      'eslint.config.js',
      '.prettierrc',
      '.prettierignore',
      '.npmrc.dist',
      '.nvmrc',
      '.husky/pre-push',
      '.husky/commit-msg',
      'vitest.config.js',
      'rolldown.config.js',
      'package.json',
    ].join('\n') + '\n'
  );
});

test('a comment beside or directly above const PROMPT names styles.module.css', () => {
  const lines = read('website/src/components/QoqAnimation/index.tsx').split('\n');
  const at = lines.findIndex((line) => line.startsWith('const PROMPT ='));
  const above = [];
  for (let i = at - 1; i >= 0 && lines[i].trimStart().startsWith('//'); i--) above.push(lines[i]);
  const beside = lines[at].includes('//') ? lines[at].slice(lines[at].indexOf('//')) : '';

  assert.match([...above, beside].join('\n'), /styles\.module\.css/);
});
