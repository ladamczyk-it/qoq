// node --test skills/qoq/scripts/discovery-check.spec.mjs
//
// The contract is the exit code plus stdout, so the test drives the script the
// way the skill does: as a subprocess, reading only what a caller reads.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('discovery-check.mjs', import.meta.url).pathname;
const RECORD_DIR = ['node_modules', '@ladamczyk', 'qoq-cli', 'bin'];

const run = (project) => {
  const { status, stdout } = spawnSync(process.execPath, [SCRIPT, '--project', project], {
    encoding: 'utf8',
  });
  return { status, stdout: stdout.trim() };
};

const fixture = ({ lock = '{"v":1}', manifest = '{"scripts":{"test":"vitest"}}', record } = {}) => {
  const project = mkdtempSync(join(tmpdir(), 'discovery-check-'));
  writeFileSync(join(project, 'package.json'), manifest);
  writeFileSync(join(project, 'package-lock.json'), lock);
  if (record !== undefined) {
    mkdirSync(join(project, ...RECORD_DIR), { recursive: true });
    writeFileSync(join(project, ...RECORD_DIR, 'qoq-skill-discovery.json'), record);
  }
  return project;
};

// The hash the script reports when it says re-discover is the one a fresh
// record must carry, so writing it back has to satisfy the next run.
test('a record carrying the current hash is used, not re-derived', () => {
  const project = fixture();
  const { status, stdout } = run(project);
  assert.equal(status, 1);

  const record = JSON.stringify({ hash: stdout, test: 'npm test' });
  const { status: second, stdout: contents } = run(fixture({ record }));
  assert.equal(second, 0);
  assert.equal(JSON.parse(contents).test, 'npm test');
});

test('a changed lockfile makes the record stale', () => {
  const { stdout: hash } = run(fixture());
  const project = fixture({ lock: '{"v":2}', record: JSON.stringify({ hash }) });
  assert.equal(run(project).status, 1);
});

// The case the lockfile alone would miss: renaming a script leaves the tree
// untouched, and every command field on the record quotes those scripts.
test('a renamed package.json script makes the record stale', () => {
  const { stdout: hash } = run(fixture());
  const project = fixture({
    manifest: '{"scripts":{"test:ci":"vitest"}}',
    record: JSON.stringify({ hash }),
  });
  assert.equal(run(project).status, 1);
});

test('a missing record asks for a fresh one', () => {
  assert.equal(run(fixture()).status, 1);
});

test('an unparsable record is treated as missing rather than half-read', () => {
  assert.equal(run(fixture({ record: '{ truncated' })).status, 1);
});

// The agent files are hashed alongside the project's, so a skill upgrade that
// ships a changed agent makes the record stale and discovery re-installs it.
// The script finds them next to itself, so the fixture is a copy of it with its
// own agents/ directory beside it.
test('a changed agent file in the skill makes the record stale', () => {
  const skill = mkdtempSync(join(tmpdir(), 'discovery-check-skill-'));
  mkdirSync(join(skill, 'scripts'));
  mkdirSync(join(skill, 'agents'));
  copyFileSync(SCRIPT, join(skill, 'scripts', 'discovery-check.mjs'));
  writeFileSync(join(skill, 'agents', 'qoq-checker.md'), 'first version\n');

  const project = fixture();
  const hashWith = (script) =>
    spawnSync(process.execPath, [script, '--project', project], { encoding: 'utf8' }).stdout.trim();

  const before = hashWith(join(skill, 'scripts', 'discovery-check.mjs'));
  writeFileSync(join(skill, 'agents', 'qoq-checker.md'), 'second version\n');
  const after = hashWith(join(skill, 'scripts', 'discovery-check.mjs'));

  assert.notEqual(before, after);
  // Same inputs, same hash — otherwise every run would look like an upgrade.
  assert.equal(after, hashWith(join(skill, 'scripts', 'discovery-check.mjs')));
});
