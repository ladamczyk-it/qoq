// node --test website/scripts/docs.node-test.mjs

import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const DOCS = fileURLToPath(new URL('../docs', import.meta.url));
const PRESETS = ['js', 'js-react', 'js-jest', 'js-jest-rtl', 'js-vitest', 'js-vitest-rtl'].flatMap(
  (stack) => [stack, stack.replace('js', 'ts')]
);
const SKILL_PAGES = [
  'index',
  'fix',
  'refactor',
  'bump',
  'plan',
  'replan',
  'execute',
  'test',
  'compress',
  'document',
  'mermaid',
  'sheriff',
  'review',
  'feedback',
];
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
const violations = (root) => {
  const found = [];
  for (const path of walk(root)) {
    const file = relative(root, path);
    if (!ALLOWED.has(file)) found.push(`${file}:1 is outside the allowed layout`);
    const lines = readFileSync(path, 'utf8').split('\n');
    if (file.endsWith('.md')) checkMd(file, lines, found);
    if (file === 'index.mdx') checkIndex(file, lines, found);
  }
  return found;
};

const checkMd = (file, lines, found) => {
  if (lines[0] !== '---') found.push(`${file}:1 first line is not exactly ---`);
  const end = lines.indexOf('---', 1);
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

const checkIndex = (file, lines, found) => {
  const stamps = lines.flatMap((line, i) => (line.includes('verified against **') ? [i] : []));
  if (stamps.length !== 1) found.push(`${file}:1 holds ${stamps.length} stamps, not 1`);
  for (const i of stamps) {
    const other = lines[i].replace('`@ladamczyk/qoq` v7.3.1', '').match(/v\d+\./);
    if (other) found.push(`${file}:${i + 1} stamp line also says ${other[0]}`);
  }
};

const withDocs = (mutate) => {
  const dir = mkdtempSync(join(tmpdir(), 'docs-guard-'));
  try {
    cpSync(DOCS, dir, { recursive: true });
    mutate(dir);
    return violations(dir);
  } finally {
    rmSync(dir, { recursive: true });
  }
};

const page = (body, front = 'title: X') => `---\n${front}\n---\n\n${body}\n`;
const add = (name, content) => (dir) => writeFileSync(join(dir, name), content);

test('the committed docs tree has no violations', () => {
  assert.deepEqual(violations(DOCS), []);
});

const cases = {
  'an import': add('installation.md', page("import x from 'y';")),
  'mdx in front matter': add('installation.md', page('x', 'title: X\nmdx: true')),
  'a slug': add('installation.md', page('x', 'title: X\nslug: /x')),
  'a JSX tag outside a fence': add('installation.md', page('<Tabs>')),
  'a link to a .mdx page': add('installation.md', page('[a](./a.mdx)')),
  'two stamps': (dir) => {
    const path = join(dir, 'index.mdx');
    const text = readFileSync(path, 'utf8');
    writeFileSync(path, `${text}\n> verified against **\`@ladamczyk/qoq\` v7.3.1**\n`);
  },
  'another version on the stamp line': (dir) => {
    const path = join(dir, 'index.mdx');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace('v7.3.1**.', 'v7.3.1**, so **v7.2.0** too.')
    );
  },
  'a stray file': add('foo.json', '{}'),
};

for (const [name, mutate] of Object.entries(cases)) {
  test(`the guard names the file when the docs get ${name}`, () => {
    const found = withDocs(mutate);

    assert.equal(found.length, 1, found.join('\n'));
    assert.match(found[0], /^(installation\.md|index\.mdx|foo\.json):\d+ /);
  });
}

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
