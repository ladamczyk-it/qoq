// node --test skills/qoq/scripts/progress.node-test.mjs
//
// The contract is the board on stdout plus the exit code, so the test drives
// the script as a subprocess over plan files shaped like assets/plan-template.md
// and assets/fullstack-template.md.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('progress.mjs', import.meta.url).pathname;

const run = (path) => spawnSync(process.execPath, [SCRIPT, path], { encoding: 'utf8' });

const ticket = (id, status) => `### Ticket ${id}: Ticket ${id}

- **Status:** ${status}
- **Depends on:** none
`;

const summary = (n) => `### Milestone ${n}: Done ${n} — delivered 2026-10-20

**Delivered:** x
`;

const plan = ({
  delivered = [],
  live = [],
  status = 'in-progress',
}) => `# Trip Tags Implementation Plan

**Goal:** tags
**Plan status:** ${status}

---

## Completed

${delivered.map(summary).join('\n')}
---

${live
  .map(
    ({ number, dependsOn = 'none', tickets }) => `## Milestone ${number}: Live ${number}

**Size:** S
**Depends on:** ${dependsOn}

${tickets.map(([id, s]) => ticket(id, s)).join('\n')}
### Milestone ${number} — Definition of done

- [ ] All tickets above are \`done\`
`
  )
  .join('\n---\n\n')}`;

const write = (dir, name, text) => {
  const path = join(dir, name);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text);
  return path;
};

test('a single plan shows delivered milestones and ticket counts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qoq-progress-'));
  const path = write(
    dir,
    'plans/p.md',
    plan({
      delivered: [1],
      live: [
        { number: 2, tickets: [['2.1', 'done'], ['2.2', 'in-progress']] },
        { number: 3, tickets: [['3.1', 'todo']] },
      ],
    })
  );

  const { status, stdout } = run(path);
  assert.equal(status, 0);
  assert.match(stdout, /^Trip Tags — in-progress$/m);
  assert.match(stdout, /1\/3 milestones delivered/);
  assert.match(stdout, /✓ M1 Done 1 — delivered 2026-10-20/);
  assert.match(stdout, /▶ M2 Live 2 — 1\/2 tickets done · in-progress 2\.2/);
  assert.match(stdout, /· M3 Live 3 — 0\/1 tickets done/);
});

// The definition-of-done heading has no colon and must not read as a milestone.
test('a milestone definition of done is not counted as a milestone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qoq-progress-'));
  const path = write(
    dir,
    'plans/p.md',
    plan({ live: [{ number: 1, tickets: [['1.1', 'todo']] }] })
  );

  assert.match(run(path).stdout, /0\/1 milestones delivered/);
});

test('blocked tickets are named and counted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qoq-progress-'));
  const path = write(
    dir,
    'plans/p.md',
    plan({ live: [{ number: 1, tickets: [['1.1', 'blocked']] }] })
  );

  const { stdout } = run(path);
  assert.match(stdout, /1 blocked/);
  assert.match(stdout, /blocked 1\.1/);
});

const manifest = `# Trip Tags — fullstack plan

**Plan status:** approved

---

## Contracts

none

## Components

| Component | Path   | Plan                |
| --------- | ------ | ------------------- |
| api       | \`api/\` | \`api/plans/p.md\` |
| web       | \`web/\` | \`web/plans/p.md\` |

## Barriers

| Waits | On | Why |
| ----- | -- | --- |
`;

const workspace = ({ api, web }) => {
  const root = mkdtempSync(join(tmpdir(), 'qoq-progress-ws-'));
  write(root, 'api/plans/p.md', api);
  write(root, 'web/plans/p.md', web);
  return write(root, 'plans/m.md', manifest);
};

test('a manifest shows each track with what it waits on', () => {
  const path = workspace({
    api: plan({ live: [{ number: 1, tickets: [['1.1', 'in-progress']] }] }),
    web: plan({
      delivered: [1],
      live: [{ number: 2, dependsOn: 'api:Milestone 1', tickets: [['2.1', 'todo']] }],
    }),
  });

  const { status, stdout } = run(path);
  assert.equal(status, 0);
  assert.match(stdout, /^Trip Tags — fullstack · approved$/m);
  assert.match(stdout, /^ {2}api — next: M1 ready/m);
  assert.match(stdout, /^ {2}web — next: M2 waiting on api:Milestone 1/m);
});

test('a barrier clears once the other plan has archived that milestone', () => {
  const path = workspace({
    api: plan({ delivered: [1], live: [{ number: 2, tickets: [['2.1', 'todo']] }] }),
    web: plan({
      live: [{ number: 1, dependsOn: 'api:Milestone 1', tickets: [['1.1', 'todo']] }],
    }),
  });

  assert.match(run(path).stdout, /web — next: M1 ready/);
});

test('a complete component plan is done', () => {
  const path = workspace({
    api: plan({ delivered: [1], status: 'complete' }),
    web: plan({ live: [{ number: 1, tickets: [['1.1', 'todo']] }] }),
  });

  assert.match(run(path).stdout, /api — next: done/);
});

// It reads; the manifest's lack of status is deliberate and must stay that way.
test('the board writes nothing', () => {
  const path = workspace({
    api: plan({ live: [{ number: 1, tickets: [['1.1', 'todo']] }] }),
    web: plan({ live: [{ number: 1, tickets: [['1.1', 'todo']] }] }),
  });
  const before = readFileSync(path, 'utf8');

  run(path);
  assert.equal(readFileSync(path, 'utf8'), before);
});

test('a missing file or no argument is a usage error', () => {
  assert.equal(run(join(tmpdir(), 'qoq-no-such-plan.md')).status, 2);
  assert.equal(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' }).status, 2);
});
