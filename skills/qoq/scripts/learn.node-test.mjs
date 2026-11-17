// node --test skills/qoq/scripts/learn.node-test.mjs
//
// Same rule as stats.node-test.mjs: every case resolves to `declined`, `ask`,
// `refused` or a usage error, because a case that resolved to `sent` would post
// to the real sink every time the suite runs. What's tested is the decision
// whether to send at all, and that both consents share one fallback file
// without erasing each other.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPTS = new URL('.', import.meta.url).pathname;

const dir = (prefix) => mkdtempSync(join(tmpdir(), prefix));

const run = (script, root, home, ...args) =>
  spawnSync(process.execPath, [join(SCRIPTS, script), ...args, '--project', root], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  });

const LESSON = ['--category', 'ticket-context', '--text', 'name the migration a ticket depends on'];
const learn = (root, home, ...args) => run('learn.mjs', root, home, ...LESSON, ...args);

test('nobody asked yet exits 1 with the exact payload shape to disclose', () => {
  const result = learn(dir('qoq-learn-'), dir('qoq-home-'));

  assert.equal(result.status, 1);
  assert.match(result.stdout, /"source":"qoq-skill","kind":"retro"/);
});

test('a stats yes is not a learning yes', () => {
  const root = dir('qoq-learn-');
  writeFileSync(join(root, 'qoq.config.js'), 'export default { stats: true };\n');

  assert.equal(learn(root, dir('qoq-home-')).status, 1);
});

test('a decline recorded in the config is honoured, and the config keeps its stats key', () => {
  const root = dir('qoq-learn-');
  const config = join(root, 'qoq.config.js');
  writeFileSync(config, 'export default { stats: true };\n');

  assert.equal(learn(root, dir('qoq-home-'), '--consent', 'no').stdout, 'declined\n');
  assert.match(readFileSync(config, 'utf8'), /learning: false,.*stats: true/);
  assert.equal(learn(root, dir('qoq-home-')).stdout, 'declined\n');
});

test('without a config both answers share the fallback file and neither erases the other', () => {
  const root = dir('qoq-learn-');
  const home = dir('qoq-home-');

  assert.equal(run('stats.mjs', root, home, 'fix', '--consent', 'no').status, 0);
  assert.equal(learn(root, home, '--consent', 'no').status, 0);

  const file = readFileSync(join(home, '.claude', 'qoq', 'consent.md'), 'utf8');
  assert.match(file, /stats: false/);
  assert.match(file, /learning: false/);
});

test('project detail is refused before consent is even looked at', () => {
  const root = dir('qoq-learn-');
  const home = dir('qoq-home-');
  const refused = (text) => run('learn.mjs', root, home, '--category', 'contract', '--text', text);

  for (const text of [
    'the `retry` helper',
    'see src/api for it',
    'rate-limit.ts was missed',
    'useRateLimit was missed',
    'RATE_LIMIT was missed',
    'needs @acme/http',
  ]) {
    assert.equal(refused(text).status, 3, text);
  }
});

test('an unknown category, empty or oversized text is a usage error', () => {
  const root = dir('qoq-learn-');
  const home = dir('qoq-home-');
  const usage = (...args) => run('learn.mjs', root, home, ...args).status;

  assert.equal(usage('--category', 'vibes', '--text', 'x'), 2);
  assert.equal(usage('--category', 'contract', '--text', '  '), 2);
  assert.equal(usage('--category', 'contract', '--text', 'a'.repeat(501)), 2);
});
