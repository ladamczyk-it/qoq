// node --test skills/qoq/scripts/feature-status.node-test.mjs
//
// The contract is the JSON a chief of staff and a repo session both branch on:
// which repo milestone may start, what it waits on, and which master milestone
// is due its integration check. Driven as a subprocess over a throwaway parent
// folder, because the files on disk are the whole input.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { index, parent } from './feature.fixture.mjs';

const SCRIPT = new URL('feature-status.mjs', import.meta.url).pathname;

const run = (root) => {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [SCRIPT, '--root', root, '--feature', 'track-io'],
    { encoding: 'utf8' }
  );
  assert.equal(status, 0, stderr);
  return JSON.parse(stdout);
};

const repo = (report, name) => report.repos.find((r) => r.name === name);

test('a consumer milestone waits on the provider milestone it names', () => {
  const report = run(
    parent({
      master: [['M1', 'todo', 'none']],
      be: index('approved', [['M1', 'in-progress', 'none', 'M1']]),
      ui: index('approved', [['M1', 'todo', 'be:M1', 'M1']]),
    })
  );

  assert.deepEqual(repo(report, 'be').next, {
    id: 'M1',
    name: 'X',
    file: 'm.md',
    status: 'in-progress',
    runnable: true,
    waitingOn: [],
  });
  assert.equal(repo(report, 'ui').next.runnable, false);
  assert.deepEqual(repo(report, 'ui').next.waitingOn, ['be:M1']);
});

test('a delivered provider milestone unblocks the consumer, and the master milestone is due integration only when every repo is delivered', () => {
  const partial = run(
    parent({
      master: [['M1', 'todo', 'none']],
      be: index('approved', [['M1', 'delivered 2026-11-20', 'none', 'M1']]),
      ui: index('approved', [['M1', 'todo', 'be:M1', 'M1']]),
    })
  );
  assert.equal(repo(partial, 'ui').next.runnable, true);
  assert.equal(partial.master[0].integrationDue, false);

  const full = run(
    parent({
      master: [['M1', 'todo', 'none']],
      be: index('approved', [['M1', 'delivered 2026-11-20', 'none', 'M1']]),
      ui: index('approved', [['M1', 'delivered 2026-11-21', 'be:M1', 'M1']]),
    })
  );
  assert.equal(full.master[0].integrationDue, true);
});

test('repo work for M2 waits until M1 has passed its integration check, not just its repo milestones', () => {
  const report = run(
    parent({
      master: [
        ['M1', 'todo', 'none'],
        ['M2', 'todo', 'M1'],
      ],
      be: index('approved', [
        ['M1', 'delivered 2026-11-20', 'none', 'M1'],
        ['M2', 'todo', 'M1', 'M2'],
      ]),
    })
  );

  assert.deepEqual(repo(report, 'be').next.waitingOn, ['M1']);
  assert.equal(repo(report, 'be').next.runnable, false);
});

test('an unknown cross-repo reference blocks instead of passing', () => {
  const report = run(
    parent({
      master: [['M1', 'todo', 'none']],
      be: index('approved', [['M1', 'todo', 'telemetry:M1', 'M1']]),
    })
  );

  assert.equal(repo(report, 'be').next.runnable, false);
  assert.deepEqual(repo(report, 'be').next.waitingOn, ['telemetry:M1']);
});

test('a missing or draft plan is never runnable', () => {
  const report = run(
    parent({
      master: [['M1', 'todo', 'none']],
      be: index('draft', [['M1', 'todo', 'none', 'M1']]),
    })
  );

  assert.equal(repo(report, 'be').planStatus, 'draft');
  assert.equal(repo(report, 'be').next.runnable, false);
  assert.equal(repo(report, 'ui').planStatus, 'missing');
  assert.equal(repo(report, 'ui').next, null);
});

test('no feature.json exits 1 with the reason', () => {
  const root = mkdtempSync(join(tmpdir(), 'qoq-feature-'));
  const { status, stderr } = spawnSync(
    process.execPath,
    [SCRIPT, '--root', root, '--feature', 'x'],
    { encoding: 'utf8' }
  );

  assert.equal(status, 1);
  assert.match(stderr, /no feature\.json/);
});

test('a repo that answered "no changes needed" has no next milestone and needs no plan', () => {
  const root = parent({
    master: [['M1', 'todo', 'none']],
    be: index('approved', [['M1', 'todo', 'none', 'M1']]),
  });
  const brd = join(root, 'feature', 'track-io', 'brd.md');
  writeFileSync(
    brd,
    readFileSync(brd, 'utf8').replace('| ui   | `plans/2026-11-19-track-io` |', '| ui   | none |')
  );
  const report = run(root);

  assert.equal(repo(report, 'ui').planStatus, 'none');
  assert.equal(repo(report, 'ui').next, null);
  assert.equal(repo(report, 'be').next.runnable, true);
});

test('a blocked milestone is skipped for a later one that is ready', () => {
  const report = run(
    parent({
      master: [['M1', 'todo', 'none']],
      be: index('approved', [['M1', 'todo', 'none', 'M1']]),
      ui: index('approved', [
        ['M1', 'todo', 'be:M1', 'M1'],
        ['M2', 'todo', 'none', 'M1'],
      ]),
    })
  );

  assert.equal(repo(report, 'ui').next.id, 'M2');
  assert.equal(repo(report, 'ui').next.runnable, true);
});

test('a milestone already in progress stays next even when another is ready', () => {
  const report = run(
    parent({
      master: [['M1', 'todo', 'none']],
      be: index('approved', [
        ['M1', 'todo', 'none', 'M1'],
        ['M2', 'in-progress', 'none', 'M1'],
      ]),
    })
  );

  assert.equal(repo(report, 'be').next.id, 'M2');
});
