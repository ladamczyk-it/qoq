// node --test skills/qoq/scripts/sync-agents.spec.mjs
//
// The contract is the line on stdout plus what ends up in .claude/agents, so
// the test drives the script as a subprocess and then looks at the directory.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('sync-agents.mjs', import.meta.url).pathname;
const SOURCE = new URL('../agents/', import.meta.url).pathname;

const run = (project) => {
  const { status, stdout } = spawnSync(process.execPath, [SCRIPT, '--project', project], {
    encoding: 'utf8',
  });
  return { status, stdout: stdout.trim() };
};

const project = () => mkdtempSync(join(tmpdir(), 'sync-agents-'));
const agentsIn = (dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort();

test("a project with no agents gets every one of the skill's, then reports nothing to do", () => {
  const dir = project();

  const first = run(dir);
  assert.equal(first.status, 0);
  assert.match(first.stdout, /^agents installed: .*registered a moment later$/);
  assert.deepEqual(agentsIn(join(dir, '.claude', 'agents')), agentsIn(SOURCE));

  // Idempotent, because this runs at the tail of every discovery.
  assert.deepEqual(run(dir), { status: 0, stdout: 'agents current' });
});

test('a copy left over from an older skill version is refreshed', () => {
  const dir = project();
  const [agent] = agentsIn(SOURCE);
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'agents', agent), 'stale\n');

  assert.match(run(dir).stdout, new RegExp(agent.replace('.md', '')));
  assert.equal(
    readFileSync(join(dir, '.claude', 'agents', agent), 'utf8'),
    readFileSync(join(SOURCE, agent), 'utf8')
  );
});

// A checkout that symlinks the agents is working on them; a copy would freeze
// the next edit out of every dispatch.
test('a symlinked agent is left as a symlink', () => {
  const dir = project();
  const [agent] = agentsIn(SOURCE);
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  symlinkSync(join(SOURCE, agent), join(dir, '.claude', 'agents', agent));

  const { stdout } = run(dir);
  assert.ok(lstatSync(join(dir, '.claude', 'agents', agent)).isSymbolicLink());
  assert.doesNotMatch(stdout, new RegExp(`\\b${agent.replace('.md', '')}\\b`));
});

test('an unknown flag is a usage error', () => {
  assert.equal(run(project()).status, 0);
  const { status } = spawnSync(process.execPath, [SCRIPT, '--force'], { encoding: 'utf8' });
  assert.equal(status, 2);
});
