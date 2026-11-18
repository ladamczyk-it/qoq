// node --test skills/qoq-fullstack/scripts/schedule.node-test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { index, parent } from '../qoq.mjs';

const SCRIPT = new URL('schedule.mjs', import.meta.url).pathname;

test('moves the piece another repo needs first, and never breaks a hard dependency', () => {
  const root = parent({
    master: [['M1', 'todo', 'none']],
    be: index('approved', [
      ['M1', 'todo', 'none', 'M1'],
      ['M2', 'todo', 'none', 'M1'],
    ]),
    ui: index('approved', [
      ['M1', 'todo', 'be:M2', 'M1'],
      ['M2', 'todo', 'M1', 'M1'],
    ]),
  });
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [SCRIPT, '--root', root, '--feature', 'track-io'],
    { encoding: 'utf8' }
  );
  assert.equal(status, 0, stderr);
  const plan = JSON.parse(stdout);
  const be = plan.repos.find((r) => r.name === 'be');
  const ui = plan.repos.find((r) => r.name === 'ui');

  // ui needs be:M2, so be delivers M2 first; ui's own M1 → M2 chain stays.
  assert.deepEqual(be.order, ['M2', 'M1']);
  assert.equal(be.reorder, true);
  assert.deepEqual(ui.order, ['M1', 'M2']);
  assert.ok(plan.span.chosen < plan.span.planned);
});
