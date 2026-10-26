// node --test skills/qoq/scripts/progress.node-test.mjs
//
// The contract is the board on stdout plus the exit code, so the test drives
// the script as a subprocess over plan files shaped like assets/plan-template.md.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('progress.mjs', import.meta.url).pathname;

const run = (path) => spawnSync(process.execPath, [SCRIPT, path], { encoding: 'utf8' });

const ticket = ([id, status]) => `### Ticket ${id}: Ticket ${id}

- **Status:** ${status}
- **Depends on:** none
`;

const summary = ({
  number,
  tickets = 2,
}) => `### Milestone ${number}: Done ${number} — delivered 2026-10-20

**Delivered:** x
**Tickets:** ${Array.from({ length: tickets }, (_, i) => `${number}.${i + 1} T \`abc123${i}\``).join(' · ')}
**Gate evidence:** refactor \`clean\` · suite \`green\`
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
    ({ number, tickets }) => `## Milestone ${number}: Live ${number}

**Size:** S
**Depends on:** none

${tickets.map(ticket).join('\n')}
### Milestone ${number} — Definition of done

- [ ] All tickets above are \`done\`
`
  )
  .join('\n---\n\n')}`;

const board = (spec) => {
  const path = join(mkdtempSync(join(tmpdir(), 'qoq-progress-')), 'p.md');
  writeFileSync(path, typeof spec === 'string' ? spec : plan(spec));
  return { path, ...run(path) };
};

// Each section is a heading line then a bar line, separated by blank lines.
const section = (stdout, heading) => {
  const block = stdout.split('\n\n').find((b) => b.startsWith(`${heading}\n`));
  assert.ok(block, `no section headed ${heading} in:\n${stdout}`);
  return block.split('\n')[1];
};

test('the head names the plan, its status and milestones delivered', () => {
  const { status, stdout } = board({
    delivered: [{ number: 1 }],
    live: [
      { number: 2, tickets: [['2.1', 'todo']] },
      { number: 3, tickets: [['3.1', 'todo']] },
    ],
  });

  assert.equal(status, 0);
  assert.equal(stdout.split('\n')[0], 'Trip Tags — in-progress · 1/3 milestones delivered');
});

test('one square per ticket, in plan order, coloured by status', () => {
  const { stdout } = board({
    live: [
      {
        number: 1,
        tickets: [
          ['1.1', 'done'],
          ['1.2', 'in-progress'],
          ['1.3', 'blocked'],
          ['1.4', 'todo'],
          ['1.5', 'done'],
        ],
      },
    ],
  });

  assert.match(section(stdout, 'M1 Live 1'), /^🟩🟦🟨🟫🟩 {2}2\/5 · /);
});

test('in-progress and blocked tickets are named after the bar, in plan order', () => {
  const { stdout } = board({
    live: [
      {
        number: 1,
        tickets: [
          ['1.1', 'blocked'],
          ['1.2', 'todo'],
          ['1.3', 'in-progress'],
        ],
      },
    ],
  });

  assert.equal(
    section(stdout, 'M1 Live 1'),
    '🟨🟫🟦  0/3 · blocked 1.1 Ticket 1.1 · in-progress 1.3 Ticket 1.3'
  );
});

test('a milestone with only todo and done tickets names none', () => {
  const { stdout } = board({
    live: [
      {
        number: 1,
        tickets: [
          ['1.1', 'done'],
          ['1.2', 'todo'],
        ],
      },
    ],
  });

  assert.equal(section(stdout, 'M1 Live 1'), '🟩🟫  1/2');
});

test('a delivered milestone is all green, one square per ticket in its summary', () => {
  const { stdout } = board({ delivered: [{ number: 1, tickets: 3 }], live: [] });

  assert.equal(section(stdout, 'M1 Done 1'), '🟩🟩🟩  3/3 · delivered 2026-10-20');
});

test('a delivered summary without a Tickets line shows no bar, not a crash', () => {
  const { status, stdout } = board(`# P Implementation Plan

**Plan status:** in-progress

## Completed

### Milestone 1: Old — delivered 2026-01-01

**Delivered:** x
`);

  assert.equal(status, 0);
  assert.equal(section(stdout, 'M1 Old'), '—  0/0 · delivered 2026-01-01');
});

test('delivered milestones come first, then live ones in plan order', () => {
  const { stdout } = board({
    delivered: [{ number: 1 }, { number: 2 }],
    live: [
      { number: 3, tickets: [['3.1', 'todo']] },
      { number: 4, tickets: [['4.1', 'todo']] },
    ],
  });

  const headings = stdout.split('\n').filter((line) => /^M\d /.test(line));
  assert.deepEqual(headings, ['M1 Done 1', 'M2 Done 2', 'M3 Live 3', 'M4 Live 4']);
});

test('blocked tickets across live milestones are counted in the head', () => {
  const { stdout } = board({
    live: [
      { number: 1, tickets: [['1.1', 'blocked']] },
      {
        number: 2,
        tickets: [
          ['2.1', 'blocked'],
          ['2.2', 'todo'],
        ],
      },
    ],
  });

  assert.match(stdout.split('\n')[0], / · 2 blocked$/);
});

test('no blocked count in the head when nothing is blocked', () => {
  const { stdout } = board({ live: [{ number: 1, tickets: [['1.1', 'in-progress']] }] });

  assert.doesNotMatch(stdout.split('\n')[0], /blocked/);
});

test('the legend comes right after the head, before any bar', () => {
  const { stdout } = board({ live: [{ number: 1, tickets: [['1.1', 'todo']] }] });

  assert.equal(stdout.split('\n\n')[1], '🟩 done · 🟦 in progress · 🟨 blocked · 🟫 to do');
});

// The definition-of-done heading has no colon and must not read as a milestone.
test('a milestone definition of done is not counted as a milestone', () => {
  const { stdout } = board({ live: [{ number: 1, tickets: [['1.1', 'todo']] }] });

  assert.match(stdout, /0\/1 milestones delivered/);
  assert.doesNotMatch(stdout, /Definition of done/);
});

// The template's placeholder lists every status; a ticket mid-edit may too.
test('a status the board does not know counts as todo', () => {
  const { stdout } = board({ live: [{ number: 1, tickets: [['1.1', 'todo | in-progress']] }] });

  assert.equal(section(stdout, 'M1 Live 1'), '🟫  0/1');
});

test('a ticket without a Status line counts as todo', () => {
  const { stdout } = board(`# P Implementation Plan

**Plan status:** approved

## Milestone 1: Bare

### Ticket 1.1: No status yet

- **Size:** S
`);

  assert.equal(section(stdout, 'M1 Bare'), '🟫  0/1');
});

// A Status line belongs to the ticket above it, never to the next milestone.
test('ticket statuses do not leak across milestones', () => {
  const { stdout } = board({
    live: [
      { number: 1, tickets: [['1.1', 'done']] },
      { number: 2, tickets: [['2.1', 'todo']] },
    ],
  });

  assert.equal(section(stdout, 'M1 Live 1'), '🟩  1/1');
  assert.equal(section(stdout, 'M2 Live 2'), '🟫  0/1');
});

test('a complete plan reports every milestone delivered', () => {
  const { stdout } = board({
    status: 'complete',
    delivered: [{ number: 1 }, { number: 2 }],
    live: [],
  });

  assert.equal(stdout.split('\n')[0], 'Trip Tags — complete · 2/2 milestones delivered');
});

test('a plan without a title or status still prints a board', () => {
  const { status, stdout } = board(`## Milestone 1: Only

### Ticket 1.1: One

- **Status:** done
`);

  assert.equal(status, 0);
  assert.equal(stdout.split('\n')[0], 'plan — unknown · 0/1 milestones delivered');
});

test('no ANSI escape codes reach stdout', () => {
  const { stdout } = board({ live: [{ number: 1, tickets: [['1.1', 'blocked']] }] });

  assert.ok(!stdout.includes('\u001b['));
});

// It reads; the plan file's status is execute's to change.
test('the board writes nothing', () => {
  const { path } = board({ live: [{ number: 1, tickets: [['1.1', 'todo']] }] });
  const before = readFileSync(path, 'utf8');

  run(path);
  assert.equal(readFileSync(path, 'utf8'), before);
});

test('a missing file or no argument is a usage error', () => {
  assert.equal(run(join(tmpdir(), 'qoq-no-such-plan.md')).status, 2);
  assert.equal(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' }).status, 2);
});
