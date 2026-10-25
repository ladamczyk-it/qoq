#!/usr/bin/env node
// Where is this plan? — the board `qoq execute` shows the user.
//
// A plan run is long and mostly silent: dispatches, gates, commits. The plan
// file already holds the answer to "how far along is it", but reading it by eye
// on every transition is how two boards come to disagree, and for a fullstack
// manifest the answer is spread over several repos' plans that other sessions
// may be writing. So one script reads the files fresh and prints one board,
// whether it was handed a single plan or a manifest.
//
// A single plan: delivered milestones from `## Completed`, live milestones and
// their tickets by `Status`. A manifest (a `## Components` table): the same
// board per component, plus each track's next milestone as ready, waiting on
// `<component>:Milestone <N>` (not under that plan's `## Completed` yet), or
// done.
//
// It reads, it never writes: the manifest holds no status on purpose, and the
// plan file's status is `execute`'s to change.
//
// Usage:   node progress.mjs <plan-or-manifest.md>
//
// Exit code: 0 board printed, 2 usage error or a file that can't be read.
// stdout is the board, meant to be shown to the user verbatim.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const [planPath] = process.argv.slice(2);

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(2);
};

if (!planPath) {
  fail('usage: progress.mjs <plan-or-manifest.md>');
}

const read = (path) => {
  if (!existsSync(path)) {
    fail(`progress.mjs: no such plan: ${path}`);
  }
  return readFileSync(path, 'utf8');
};

const title = (text) =>
  (text.match(/^# (.+)$/m)?.[1] ?? 'plan')
    .replace(/ Implementation Plan$/, '')
    .replace(/ — fullstack plan$/, '');

const planStatus = (text) => text.match(/^\*\*Plan status:\*\*\s*(\S+)/m)?.[1] ?? 'unknown';

// Split a plan into its delivered summaries and its live milestones. Only the
// headings matter: `### Milestone N: … — delivered <date>` under Completed, and
// `## Milestone N: …` for live ones. `### Milestone N — Definition of done` has
// no colon and is never matched.
const parsePlan = (text) => {
  const delivered = [
    ...text.matchAll(/^### Milestone (\d+): (.+?) — delivered (\S+)\s*$/gm),
  ].map(([, number, name, date]) => ({ number: Number(number), name, date }));

  const live = [];
  let milestone;
  let ticket;
  for (const line of text.split('\n')) {
    const heading = line.match(/^## Milestone (\d+): (.+?)\s*$/);
    if (heading) {
      milestone = { number: Number(heading[1]), name: heading[2], dependsOn: [], tickets: [] };
      live.push(milestone);
      ticket = undefined;
      continue;
    }
    if (/^## /.test(line)) {
      milestone = undefined;
      ticket = undefined;
      continue;
    }
    if (!milestone) {
      continue;
    }
    const depends = !ticket && line.match(/^\*\*Depends on:\*\*\s*(.+)$/);
    if (depends) {
      milestone.dependsOn = [...depends[1].matchAll(/([\w.-]+):Milestone (\d+)/g)].map(
        ([, component, number]) => ({ component, number: Number(number) })
      );
      continue;
    }
    const ticketHeading = line.match(/^### Ticket (\d+\.\d+): (.+?)\s*$/);
    if (ticketHeading) {
      ticket = { id: ticketHeading[1], name: ticketHeading[2], status: 'todo' };
      milestone.tickets.push(ticket);
      continue;
    }
    const status = ticket && line.match(/^- \*\*Status:\*\*\s*([\w-]+)/);
    if (status) {
      ticket.status = status[1];
    }
  }

  return { delivered, live };
};

const count = (tickets, status) => tickets.filter((t) => t.status === status).length;

const milestoneLine = ({ number, name, tickets }) => {
  const done = count(tickets, 'done');
  const notes = tickets
    .filter((t) => t.status === 'in-progress' || t.status === 'blocked')
    .map((t) => `${t.status} ${t.id} ${t.name}`);
  const mark = done || notes.length ? '▶' : '·';
  return [`${mark} M${number} ${name} — ${done}/${tickets.length} tickets done`, ...notes].join(
    ' · '
  );
};

const board = ({ delivered, live }, indent = '') => {
  const tickets = live.flatMap((m) => m.tickets);
  const total = delivered.length + live.length;
  const blocked = count(tickets, 'blocked');
  const head = [
    `${delivered.length}/${total} milestones delivered`,
    `open milestones' tickets ${count(tickets, 'done')}/${tickets.length} done`,
    ...(blocked ? [`${blocked} blocked`] : []),
  ].join(' · ');
  return [
    head,
    ...delivered.map((m) => `${indent}✓ M${m.number} ${m.name} — delivered ${m.date}`),
    ...live.map((m) => `${indent}${milestoneLine(m)}`),
  ];
};

const text = read(planPath);
const components = text.match(/^## Components\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m);

if (!components) {
  process.stdout.write(
    `${[`${title(text)} — ${planStatus(text)}`, ...board(parsePlan(text), '  ')].join('\n')}\n`
  );
  process.exit(0);
}

// A manifest. Its component paths are relative to the workspace root, which is
// the directory holding the manifest's `plans/`.
const root = resolve(dirname(planPath), '..');
const rows = components[1]
  .split('\n')
  .filter((line) => line.startsWith('|'))
  .map((line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/^`|`$/g, ''))
  )
  .filter((cells) => cells.length >= 3 && !/^-+$/.test(cells[0]) && cells[0] !== 'Component');

const tracks = rows.map(([name, , plan]) => {
  const planText = read(join(root, plan));
  return { name, plan: parsePlan(planText), status: planStatus(planText) };
});
const byName = new Map(tracks.map((track) => [track.name, track]));

const isDelivered = (component, number) =>
  byName.get(component)?.plan.delivered.some((m) => m.number === number) ?? false;

const next = ({ plan, status }) => {
  const milestone = plan.live[0];
  if (!milestone || status === 'complete') {
    return 'done';
  }
  const waits = milestone.dependsOn
    .filter((d) => !isDelivered(d.component, d.number))
    .map((d) => `${d.component}:Milestone ${d.number}`);
  return waits.length
    ? `M${milestone.number} waiting on ${waits.join(', ')}`
    : `M${milestone.number} ready`;
};

const lines = [`${title(text)} — fullstack · ${planStatus(text)}`];
for (const track of tracks) {
  const [head, ...rest] = board(track.plan, '    ');
  lines.push(`  ${track.name} — next: ${next(track)} · ${head}`, ...rest);
}
process.stdout.write(`${lines.join('\n')}\n`);
