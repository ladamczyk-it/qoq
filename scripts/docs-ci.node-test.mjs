// node --test scripts/docs-ci.node-test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEMPLATE = join(ROOT, '..', 'cli-template');
const TEMPLATE_REF = 'f5fc136';
const haveTemplate = existsSync(TEMPLATE);
const skipTemplate = haveTemplate ? false : '../cli-template is absent';

const ours = (path) => readFileSync(join(ROOT, path), 'utf8');
const git = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
const template = (path) => git(TEMPLATE, 'show', `${TEMPLATE_REF}:${path}`).stdout;

// the template with exactly one occurrence of each `from` swapped, so a drifted template fails loudly
const edit = (text, pairs) =>
  pairs.reduce((acc, [from, to]) => {
    assert.equal(acc.split(from).length - 1, 1, `template holds ${from} once`);
    return acc.replaceAll(from, to);
  }, text);

test('.woodpecker/main.yml replaces .woodpecker.yml byte for byte', () => {
  assert.equal(existsSync(join(ROOT, '.woodpecker.yml')), false);
  const deleted = git(
    ROOT,
    'log',
    '--diff-filter=D',
    '-1',
    '--format=%H',
    '--',
    '.woodpecker.yml'
  ).stdout.trim();
  const before = git(ROOT, 'show', `${deleted ? `${deleted}^` : 'HEAD'}:.woodpecker.yml`).stdout;
  assert.equal(ours('.woodpecker/main.yml'), before);
});

test(
  'docs.yml differs from the template only in the publish clone branch',
  { skip: skipTemplate },
  () => {
    const expected = edit(template('.woodpecker/docs.yml'), [
      ['--branch main ', '--branch "$CI_REPO_DEFAULT_BRANCH" '],
    ]);
    assert.equal(ours('.woodpecker/docs.yml'), expected);
    assert.doesNotMatch(ours('.woodpecker/docs.yml'), /--branch main/);
  }
);

test(
  'publish-docs.sh pushes to the default branch and differs from the template in nothing else',
  { skip: skipTemplate },
  () => {
    const expected = edit(template('scripts/publish-docs.sh'), [
      ['HEAD:refs/heads/main', 'HEAD:refs/heads/${CI_REPO_DEFAULT_BRANCH:-main}'],
    ]);
    assert.equal(ours('scripts/publish-docs.sh'), expected);
    assert.match(
      ours('scripts/publish-docs.sh'),
      /HEAD:refs\/heads\/\$\{CI_REPO_DEFAULT_BRANCH:-main\}/
    );
  }
);

test(
  'check-docs.sh builds and relinks bins right after npm ci and differs in nothing else',
  { skip: skipTemplate },
  () => {
    const ci = 'npm ci --ignore-scripts --no-audit --no-fund\n';
    const expected = edit(template('scripts/check-docs.sh'), [
      [ci, `${ci}npm run build --if-present\nnpm rebuild --ignore-scripts\n`],
    ]);
    assert.equal(ours('scripts/check-docs.sh'), expected);
    const lines = ours('scripts/check-docs.sh').split('\n');
    assert.equal(lines[lines.indexOf(ci.trim()) + 1], 'npm run build --if-present');
    assert.equal(lines[lines.indexOf(ci.trim()) + 2], 'npm rebuild --ignore-scripts');
  }
);

test(
  'update-docs.sh names the source dirs that exist and differs in nothing else',
  { skip: skipTemplate },
  () => {
    const loop =
      'for doc in README.md CLAUDE.md AGENTS.md; do\n  [ -f "$doc" ] && sources="$sources$doc, "\ndone\n';
    const dirs =
      'for dir in src/ packages/ skills/; do\n  [ -d "$dir" ] && sources="$sources$dir, "\ndone\nsources="${sources%, }"\n';
    const expected = edit(template('scripts/update-docs.sh'), [
      [loop, loop + dirs],
      ['(${sources}src/)', '(${sources})'],
    ]);
    assert.equal(ours('scripts/update-docs.sh'), expected);
  }
);

test('update-docs.sh refuses the tokens each phase must not hold', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'docs-ci-'));
  mkdirSync(join(cwd, 'website/docs'), { recursive: true });
  writeFileSync(
    join(cwd, 'website/docs/index.mdx'),
    'Content is verified against **`@x/y` v0.0.0**\n'
  );
  // the freeze phase reads the stamp from HEAD
  git(cwd, 'init', '-q');
  git(cwd, 'add', '.');
  git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'fixture');
  const refused = {
    install: ['CLAUDE_CODE_OAUTH_TOKEN', 'GITHUB_TOKEN'],
    freeze: ['VERDACCIO_CI_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'GITHUB_TOKEN'],
    generate: ['VERDACCIO_CI_TOKEN', 'GITHUB_TOKEN'],
  };
  const required = { install: 'VERDACCIO_CI_TOKEN', generate: 'CLAUDE_CODE_OAUTH_TOKEN' };
  for (const [phase, names] of Object.entries(refused)) {
    for (const name of names) {
      const env = { PATH: process.env.PATH, CI_COMMIT_TAG: 'v7.3.1', [name]: 'x' };
      if (required[phase]) env[required[phase]] = 'x';
      const run = spawnSync('bash', [join(ROOT, 'scripts/update-docs.sh'), phase], {
        cwd,
        env,
        encoding: 'utf8',
      });
      assert.notEqual(run.status, 0, `${phase} with ${name}`);
      assert.match(run.stderr, new RegExp(`${name} must not be set in the ${phase} phase`));
    }
  }
});

test('publish-docs.sh refuses to run without GITHUB_TOKEN', () => {
  const env = { PATH: process.env.PATH, CI_COMMIT_TAG: 'v7.3.1' };
  const run = spawnSync('bash', [join(ROOT, 'scripts/publish-docs.sh'), tmpdir()], {
    env,
    encoding: 'utf8',
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /GITHUB_TOKEN is required to publish the docs/);
});
