// node --test website/scripts/docs.node-test.mjs

import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const DOCS = fileURLToPath(new URL('../docs', import.meta.url));
const PACKAGES = fileURLToPath(new URL('../../packages', import.meta.url));
const VARIANTS_TS = fileURLToPath(
  new URL('../src/components/ConfigInspector/variants.ts', import.meta.url)
);
const { version: VERSION } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')
);
const PRESETS = ['js', 'js-react', 'js-jest', 'js-jest-rtl', 'js-vitest', 'js-vitest-rtl'].flatMap(
  (stack) => [stack, stack.replace('js', 'ts')]
);
const SKILL_PAGES =
  'index fix refactor bump plan replan execute test compress document mermaid sheriff review feedback'.split(
    ' '
  );
const ALLOWED = new Set([
  'index.mdx',
  'installation.md',
  'configuration.md',
  'packages.md',
  'skills/_category_.json',
  'skills/qoq-fullstack.md',
  'skills/qoq/_category_.json',
  ...SKILL_PAGES.map((page) => `skills/qoq/${page}.md`),
  'presets/_category_.json',
  ...PRESETS.map((preset) => `presets/eslint-v9-${preset}.mdx`),
]);

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  );

// Returns one "file:line message" string per violation.
const violations = (root, version = VERSION) => {
  const found = [];
  const present = new Set();
  for (const path of walk(root)) {
    const file = relative(root, path);
    present.add(file);
    if (!ALLOWED.has(file)) found.push(`${file}:1 is outside the allowed layout`);
    const lines = readFileSync(path, 'utf8').split('\n');
    if (file.endsWith('.md')) checkMd(file, lines, found);
    if (file === 'index.mdx') checkIndex(file, lines, found, version);
    if (/^presets\/eslint-v9-.*\.mdx$/.test(file)) checkVariant(file, lines, found);
  }
  for (const file of ALLOWED) if (!present.has(file)) found.push(`${file}:1 is missing`);
  return found;
};

const checkMd = (file, lines, found) => {
  if (lines[0] !== '---') found.push(`${file}:1 first line is not exactly ---`);
  const end = lines.findIndex((line, i) => i > 0 && line.startsWith('---'));
  if (end === -1) found.push(`${file}:1 front matter is never closed`);
  let fenced = false;
  lines.forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (i > 0 && i < end) {
      if (/mdx/i.test(line)) found.push(`${at} front matter names mdx`);
      if (line.includes('\\')) found.push(`${at} front matter holds a backslash`);
      if (line.startsWith('slug:')) found.push(`${at} front matter has a slug`);
    }
    if (line.startsWith('```')) fenced = !fenced;
    else if (!fenced) {
      if (/^(import|export) /.test(line)) found.push(`${at} line starts with import or export`);
      if (/<[A-Z]/.test(line.replace(/`[^`]*`/g, '')))
        found.push(`${at} JSX component tag outside a fence`);
    }
    for (const [, target] of line.matchAll(/\]\(([^)\s#]*\.mdx)(?:#[^)]*)?\)/g)) {
      if (!/(^|\/)index\.mdx$|presets\/[^/]+\.mdx$/.test(target)) {
        found.push(`${at} links to ${target}`);
      }
    }
  });
};

const checkIndex = (file, lines, found, version) => {
  const stamps = lines.flatMap((line, i) => (line.includes('verified against **') ? [i] : []));
  if (stamps.length !== 1) found.push(`${file}:1 holds ${stamps.length} stamps, not 1`);
  for (const i of stamps) {
    const stamp = `\`@ladamczyk/qoq\` v${version}**`;
    const other = lines[i].replace(stamp, '').match(/v\d+\./);
    if (!lines[i].includes(stamp)) found.push(`${file}:${i + 1} stamp is not v${version}`);
    else if (other) found.push(`${file}:${i + 1} stamp line also says ${other[0]}`);
  }
};

const checkVariant = (file, lines, found) => {
  const expected = `variant="${file.replace(/^presets\/|\.mdx$/g, '')}"`;
  const used = lines.flatMap((line, i) => (line.includes('variant=') ? [i] : []));
  if (used.length !== 1) found.push(`${file}:1 holds ${used.length} variant=, not 1`);
  for (const i of used) {
    if (!lines[i].includes(expected)) found.push(`${file}:${i + 1} variant is not ${expected}`);
  }
};

// Returns one message per suffix that is not in all three lists.
const suffixDrift = (lists) => {
  const all = new Set(Object.values(lists).flat());
  return [...all].flatMap((suffix) =>
    Object.entries(lists)
      .filter(([, list]) => !list.includes(suffix))
      .map(([name]) => `${suffix} is missing from ${name}`)
  );
};

const withDocs = (mutate, version) => {
  const dir = mkdtempSync(join(tmpdir(), 'docs-guard-'));
  try {
    cpSync(DOCS, dir, { recursive: true });
    mutate(dir);
    return violations(dir, version);
  } finally {
    rmSync(dir, { recursive: true });
  }
};

const page = (body, front = 'title: X') => `---\n${front}\n---\n\n${body}\n`;
const add = (name, content) => (dir) => writeFileSync(join(dir, name), content);

test('the committed docs tree has no violations', () => {
  assert.deepEqual(violations(DOCS), []);
});

const restamp = (version) => (dir) => {
  const path = join(dir, 'index.mdx');
  writeFileSync(path, readFileSync(path, 'utf8').replace(`v${VERSION}**`, `v${version}**`));
};

const cases = {
  'an import': add('installation.md', page("import x from 'y';")),
  'mdx in front matter': add('installation.md', page('x', 'title: X\nmdx: true')),
  'a slug': add('installation.md', page('x', 'title: X\nslug: /x')),
  'a JSX tag outside a fence': add('installation.md', page('<Tabs>')),
  'a link to a .mdx page': add('installation.md', page('[a](./a.mdx)')),
  'two stamps': (dir) => {
    const path = join(dir, 'index.mdx');
    const text = readFileSync(path, 'utf8');
    writeFileSync(path, `${text}\n> verified against **\`@ladamczyk/qoq\` v${VERSION}**\n`);
  },
  'another version on the stamp line': (dir) => {
    const path = join(dir, 'index.mdx');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(`v${VERSION}**.`, `v${VERSION}**, so **v7.2.0** too.`)
    );
  },
  'a stamp at another version than the root package.json': restamp('9.9.9'),
  'a missing file': (dir) => rmSync(join(dir, 'installation.md')),
  'front matter that never closes': add('installation.md', '---\ntitle: X\n\nbody\n'),
  'a stray file': add('foo.json', '{}'),
};

for (const [name, mutate] of Object.entries(cases)) {
  test(`the guard names the file when the docs get ${name}`, () => {
    const found = withDocs(mutate);

    assert.equal(found.length, 1, found.join('\n'));
    assert.match(found[0], /^(installation\.md|index\.mdx|foo\.json):\d+ /);
  });
}

test('a release that restamps the index to the expected version passes', () => {
  assert.deepEqual(withDocs(restamp('9.9.9'), '9.9.9'), []);
});

test('placeholders inside inline code pass', () => {
  const body = 'Use `m<N>` or `/qoq review <PR link>` here.';

  assert.deepEqual(withDocs(add('installation.md', page(body))), []);
});

test('a bare JSX tag on a line with inline code still fails', () => {
  const found = withDocs(add('installation.md', page('<Tabs> and `code`')));

  assert.equal(found.length, 1, found.join('\n'));
  assert.match(found[0], /^installation\.md:\d+ /);
});

test('a JSX tag inside a fenced block passes', () => {
  assert.deepEqual(withDocs(add('installation.md', page('```jsx\n<Tabs>\n```'))), []);
});

test('the guard names the page when a preset page embeds another variant', () => {
  const found = withDocs((dir) => {
    const path = join(dir, 'presets/eslint-v9-ts.mdx');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace('variant="eslint-v9-ts"', 'variant="eslint-v9-js"')
    );
  });

  assert.equal(found.length, 1, found.join('\n'));
  assert.match(found[0], /^presets\/eslint-v9-ts\.mdx:\d+ /);
});

const treeSuffixes = () => ({
  PRESETS,
  packages: readdirSync(PACKAGES)
    .filter((name) => name.startsWith('eslint-v9-'))
    .map((name) => name.replace('eslint-v9-', '')),
  'variants.ts': [
    ...readFileSync(VARIANTS_TS, 'utf8')
      .match(/VARIANT_SUFFIXES = \[([^\]]*)\]/)[1]
      .matchAll(/'([^']+)'/g),
  ].map(([, suffix]) => suffix),
});

test('PRESETS, the eslint-v9 packages and variants.ts list the same suffixes', () => {
  const lists = treeSuffixes();

  assert.equal(lists['variants.ts'].length, 12);
  assert.deepEqual(suffixDrift(lists), []);
});

test('suffix drift names the list that lacks the suffix', () => {
  const lists = treeSuffixes();

  assert.deepEqual(suffixDrift({ ...lists, packages: lists.packages.slice(1) }), [
    `${lists.packages[0]} is missing from packages`,
  ]);
});
