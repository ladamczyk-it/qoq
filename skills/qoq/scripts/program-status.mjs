#!/usr/bin/env node
// Rebuilds a program's state from disk: the parent folder's program.json, the
// BRD's master milestone table, and each repo's plan index. Nothing is cached —
// the files are the state, so a chief of staff that restarted, or a repo session
// asking whether its next milestone may start, both get the same answer.
//
// Usage:   node program-status.mjs --root <parent folder> --program <slug> [--json | --schedule]
//   --schedule  the delivery order per repo that waits least (program-schedule.mjs), as JSON
//
// Exit code: 0 with a report on stdout; 1 when program.json or the BRD is
// missing or unreadable (stderr says which).

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { schedule } from './program-schedule.mjs';
import { programState, repoPlans, table } from './program-state.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const root = resolve(flag('root') ?? process.cwd());
const slug = flag('program');

if (!slug) {
  fail('--program <slug> is required');
}

const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined);

const programFile = read(join(root, 'program.json'));

if (programFile === undefined) {
  fail(`no program.json in ${root}`);
}

let program;

try {
  program = JSON.parse(programFile);
} catch (error) {
  fail(`program.json is not valid JSON: ${error.message}`);
}

const brdPath = join(root, 'program', slug, 'brd.md');
const brd = read(brdPath);

if (brd === undefined) {
  fail(`no BRD at ${brdPath}`);
}

const plans = repoPlans(brd);
const indexes = Object.fromEntries(
  (program.repos ?? []).map((repo) => [
    repo.name,
    plans.has(repo.name) && plans.get(repo.name) !== 'none'
      ? read(join(root, repo.path, plans.get(repo.name), 'index.md'))
      : undefined,
  ])
);
const report = programState({ slug, program, brd, indexes });

if (args.includes('--schedule')) {
  // Ticket counts stand in for each milestone's duration.
  const tickets = Object.fromEntries(
    (program.repos ?? []).map((repo) => {
      const dir = plans.get(repo.name);
      const rows = table(indexes[repo.name] ?? '', ['#', 'Milestone']);
      return [
        repo.name,
        Object.fromEntries(
          rows.map((row) => {
            const start = row.Milestone.indexOf('](');
            const file =
              start === -1 ? '' : row.Milestone.slice(start + 2, row.Milestone.indexOf(')', start));
            const text = file ? (read(join(root, repo.path, dir, file)) ?? '') : '';
            return [row['#'], (text.match(/^### Ticket /gm) ?? []).length];
          })
        ),
      ];
    })
  );
  process.stdout.write(
    `${JSON.stringify(schedule({ program, brd, indexes, tickets }), null, 2)}\n`
  );
  process.exit(0);
}

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

const out = [
  `# ${slug} — program ${report.status}`,
  '',
  '| Master | Status | Repo milestones | Integration |',
  '| --- | --- | --- | --- |',
];

for (const m of report.master) {
  const served = m.repos.map((rm) => `${rm.repo}:${rm.id} ${rm.status}`).join('<br>') || 'none yet';
  const integration = m.integrationDue ? 'due' : m.integration.join(', ') || 'none';
  out.push(`| ${m.id} ${m.name} | ${m.status} | ${served} | ${integration} |`);
}

out.push('', '| Repo | Plan | Next | Waiting on |', '| --- | --- | --- | --- |');

for (const repo of report.repos) {
  const runnable = repo.next?.runnable ? ' — runnable' : '';
  const next = repo.next ? `${repo.next.id} ${repo.next.status}${runnable}` : 'done';
  out.push(
    `| ${repo.name} | ${repo.planStatus} | ${next} | ${repo.next?.waitingOn.join(', ') || '—'} |`
  );
}

process.stdout.write(`${out.join('\n')}\n`);
