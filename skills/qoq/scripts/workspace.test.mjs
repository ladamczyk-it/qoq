#!/usr/bin/env node
// Self-check for workspace.mjs run isolation — the invariant that makes a
// parallel wave safe: one run's cleanup must never destroy another's snapshot.
// Run: node skills/qoq/scripts/workspace.test.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./workspace.mjs', import.meta.url));
const repo = mkdtempSync(join(tmpdir(), 'qoq-ws-'));
const sh = (cmd, args, cwd = repo) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const ws = (...args) => sh('node', [SCRIPT, ...args]);

try {
  sh('git', ['init', '-q']);
  sh('git', ['config', 'user.email', 't@t']);
  sh('git', ['config', 'user.name', 't']);
  writeFileSync(join(repo, '.gitignore'), 'node_modules\n');
  writeFileSync(join(repo, 'tracked.ts'), 'export const a = 1;\n');
  sh('git', ['add', '.']);
  sh('git', ['commit', '-qm', 'init']);

  // Two concurrent runs, each with an untracked file only it owns.
  writeFileSync(join(repo, 'new-a.ts'), 'a\n');
  writeFileSync(join(repo, 'new-b.ts'), 'b\n');
  ws('init', '--run', 'ticket-a');
  ws('init', '--run', 'ticket-b');
  ws('snapshot', '--run', 'ticket-a', '--', 'new-a.ts');
  ws('snapshot', '--run', 'ticket-b', '--', 'new-b.ts');

  assert.ok(existsSync(join(repo, '.qoq/runs/ticket-a/snapshot/new-a.ts')), 'a snapshotted');
  assert.ok(existsSync(join(repo, '.qoq/runs/ticket-b/snapshot/new-b.ts')), 'b snapshotted');

  // The whole point: a finishing before b must not take b's restore path with it.
  ws('cleanup', '--run', 'ticket-a');
  assert.ok(!existsSync(join(repo, '.qoq/runs/ticket-a')), "a's run dir gone");
  assert.ok(
    existsSync(join(repo, '.qoq/runs/ticket-b/snapshot/new-b.ts')),
    "b's snapshot survived"
  );
  assert.ok(readFileSync(join(repo, '.gitignore'), 'utf8').includes('.qoq/'), 'ignore entry kept');

  // Shared command cache is written once and readable by any run.
  ws('commands', '--set', '{"lint":"npm run qoq:check"}');
  assert.equal(JSON.parse(ws('commands')).lint, 'npm run qoq:check', 'cache shared across runs');

  // Last one out tears down and reverts the .gitignore exactly.
  ws('cleanup', '--run', 'ticket-b');
  assert.ok(!existsSync(join(repo, '.qoq')), 'workspace removed');
  assert.equal(readFileSync(join(repo, '.gitignore'), 'utf8'), 'node_modules\n', 'gitignore exact');

  // A double-appended block (init racing with itself) must fully self-heal.
  ws('init', '--run', 'solo');
  const gi = join(repo, '.gitignore');
  const [block] = readFileSync(gi, 'utf8').match(
    /# --- QoQ workspace[\s\S]*?# --- end QoQ workspace ---\n/
  );
  writeFileSync(gi, readFileSync(gi, 'utf8') + block);
  ws('cleanup', '--run', 'solo');
  assert.equal(readFileSync(gi, 'utf8'), 'node_modules\n', 'both blocks stripped');

  process.stdout.write('workspace.test.mjs: all checks passed\n');
} finally {
  rmSync(repo, { recursive: true, force: true });
}
