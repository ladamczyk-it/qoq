// A throwaway parent folder for the feature scripts' node:test specs: feature.json,
// a BRD, and plan indexes for two repos, be and ui. Test-only.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const write = (path, content) => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
};

export const index = (status, rows) => `# Plan

**Plan status:** ${status}

## Milestones

| #   | Milestone       | Status | Depends on | Serves | Summary |
| --- | --------------- | ------ | ---------- | ------ | ------- |
${rows.map(([id, st, deps, serves]) => `| ${id} | [X](m.md) | ${st} | ${deps} | ${serves} | s |`).join('\n')}
`;

export const parent = ({ master, be, ui }) => {
  const root = mkdtempSync(join(tmpdir(), 'qoq-feature-'));
  write(
    join(root, 'feature.json'),
    JSON.stringify({
      repos: [
        { name: 'be', path: 'trackbook-be', role: 'api' },
        { name: 'ui', path: 'trackbook-fe', role: 'ui', after: ['be'] },
      ],
    })
  );
  write(
    join(root, 'feature', 'track-io', 'brd.md'),
    `# Track IO

**Feature status:** approved

## Master milestones

| #   | Milestone | Status | Depends on | Roles | Integration |
| --- | --------- | ------ | ---------- | ----- | ----------- |
${master.map(([id, st, deps]) => `| ${id} | Name | ${st} | ${deps} | api, ui | e2e |`).join('\n')}

## Repo plans

| Repo | Plan |
| ---- | ---- |
| be   | \`plans/2026-11-18-track-io\` |
| ui   | \`plans/2026-11-19-track-io\` |
`
  );
  if (be) {
    write(join(root, 'trackbook-be', 'plans', '2026-11-18-track-io', 'index.md'), be);
  }
  if (ui) {
    write(join(root, 'trackbook-fe', 'plans', '2026-11-19-track-io', 'index.md'), ui);
  }
  return root;
};
