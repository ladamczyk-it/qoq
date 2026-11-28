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
const TEMPLATE_REF = '98a157b';
const haveTemplate = existsSync(TEMPLATE);
const skipTemplate = haveTemplate ? false : '../cli-template is absent';

const ours = (path) => readFileSync(join(ROOT, path), 'utf8');
const git = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
const template = (path) => git(TEMPLATE, 'show', `${TEMPLATE_REF}:${path}`).stdout;

test('the old single-file .woodpecker.yml stays gone', () => {
  assert.equal(existsSync(join(ROOT, '.woodpecker.yml')), false);
});

// qoq's tweaks (default-branch publish, build + relink after npm ci, source dirs) are upstream now: verbatim copies.
for (const path of [
  '.woodpecker/docs.yml',
  'scripts/publish-docs.sh',
  'scripts/check-docs.sh',
  'scripts/update-docs.sh',
]) {
  test(`${path} matches the template`, { skip: skipTemplate }, () => {
    assert.equal(ours(path), template(path));
  });
}

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
