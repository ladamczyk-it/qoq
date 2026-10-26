#!/usr/bin/env node
// Where is this plan? — the board `qoq execute` shows the user.
//
// A plan run is long and mostly silent: dispatches, gates, commits. The plan
// file already holds the answer to "how far along is it", but reading it by eye
// on every transition is how the board comes to disagree with the file. So one
// script reads the file fresh and prints the board.
//
// The head, a legend, then one section per milestone, delivered ones first: a
// heading, then a bar with one square per ticket in plan order — 🟩 done,
// 🟦 in-progress, 🟨 blocked, 🟫 todo — and the in-progress and blocked tickets
// named after it. A delivered milestone's tickets are its summary's
// `**Tickets:**` entries, all done.
//
// Emoji, not ANSI colour: the board is read in the Bash tool's output, where
// escape codes either show as junk or are stripped, and emoji render the same
// in a terminal, on claude.ai and pasted anywhere.
//
// It reads, it never writes: the plan file's status is `execute`'s to change.
//
// Usage:   node progress.mjs <plan.md>
//
// Exit code: 0 board printed, 2 usage error or a file that can't be read.
// stdout is the board; the user reads it in the tool output.

import { existsSync, readFileSync } from 'node:fs';

const [planPath] = process.argv.slice(2);

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(2);
};

if (!planPath) {
  fail('usage: progress.mjs <plan.md>');
}
if (!existsSync(planPath)) {
  fail(`progress.mjs: no such plan: ${planPath}`);
}

const SQUARES = { done: '🟩', 'in-progress': '🟦', blocked: '🟨', todo: '🟫' };
const LEGEND = '🟩 done · 🟦 in progress · 🟨 blocked · 🟫 to do';

const text = readFileSync(planPath, 'utf8');

const title = (text.match(/^# (.+)$/m)?.[1] ?? 'plan').replace(/ Implementation Plan$/, '');
const planStatus = text.match(/^\*\*Plan status:\*\*\s*(\S+)/m)?.[1] ?? 'unknown';

// Only the headings and two fields matter: `### Milestone N: … — delivered
// <date>` and its `**Tickets:**` under Completed, `## Milestone N: …` and each
// `### Ticket` `Status` for live ones. `### Milestone N — Definition of done`
// has no colon and is never matched.
const delivered = [];
const live = [];
let section;
let ticket;
for (const line of text.split('\n').map((l) => l.trimEnd())) {
  const summary = line.match(/^### Milestone (\d+): (.+?) — delivered (\S+)$/);
  if (summary) {
    section = { number: Number(summary[1]), name: summary[2], date: summary[3], tickets: [] };
    delivered.push(section);
    ticket = undefined;
    continue;
  }
  const heading = line.match(/^## Milestone (\d+): (.+)$/);
  if (heading) {
    section = { number: Number(heading[1]), name: heading[2], tickets: [] };
    live.push(section);
    ticket = undefined;
    continue;
  }
  if (/^## /.test(line)) {
    section = undefined;
    ticket = undefined;
    continue;
  }
  if (!section) {
    continue;
  }
  const tickets = section.date && line.match(/^\*\*Tickets:\*\*(.+)$/);
  if (tickets) {
    section.tickets = tickets[1].split(' · ').map(() => ({ status: 'done' }));
    continue;
  }
  const ticketHeading = !section.date && line.match(/^### Ticket (\d+\.\d+): (.+)$/);
  if (ticketHeading) {
    ticket = { id: ticketHeading[1], name: ticketHeading[2], status: 'todo' };
    section.tickets.push(ticket);
    continue;
  }
  const status = ticket && line.match(/^- \*\*Status:\*\*\s*([\w-]+)/);
  if (status) {
    ticket.status = Object.hasOwn(SQUARES, status[1]) ? status[1] : 'todo';
  }
}

const count = (tickets, status) => tickets.filter((t) => t.status === status).length;

const milestoneSection = ({ number, name, date, tickets }) => {
  const done = count(tickets, 'done');
  const bar = tickets.length ? tickets.map((t) => SQUARES[t.status]).join('') : '—';
  const notes = date
    ? [`delivered ${date}`]
    : tickets
        .filter((t) => t.status === 'in-progress' || t.status === 'blocked')
        .map((t) => `${t.status} ${t.id} ${t.name}`);
  return [`M${number} ${name}`, [`${bar}  ${done}/${tickets.length}`, ...notes].join(' · ')];
};

const blocked = count(
  live.flatMap((m) => m.tickets),
  'blocked'
);
const head = [
  `${title} — ${planStatus}`,
  `${delivered.length}/${delivered.length + live.length} milestones delivered`,
  ...(blocked ? [`${blocked} blocked`] : []),
].join(' · ');

const sections = [...delivered, ...live].map((m) => milestoneSection(m).join('\n'));
process.stdout.write(`${[head, LEGEND, ...sections].join('\n\n')}\n`);
