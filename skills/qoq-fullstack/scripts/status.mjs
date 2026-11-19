#!/usr/bin/env node
// `/qoq-fullstack status`: qoq's feature-status.mjs report, as two tables for the
// user. Read-only. The rules live in qoq's feature-state.mjs, so this table, the
// band and every repo session agree on what may start.
//
// Usage:   node status.mjs --root <parent folder> --feature <slug>

import { featureState, loadFeature } from '../qoq.mjs';

const { slug, feature, brd, indexes } = loadFeature();
const report = featureState({ slug, feature, brd, indexes });

const out = [
  `# ${slug} — feature ${report.status}`,
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
