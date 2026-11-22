#!/usr/bin/env node
// Are the reports in <report-dir> still current for <scope>?
//
// `check.mjs` asks this at the top of every `qoq fix` loop, and re-running every
// tool each time is the most expensive thing in the system. This is the cheap
// answer: an mtime comparison. Reports are current only when the OLDEST report
// on disk is newer than the NEWEST file in scope — one source file touched
// after one report was written makes the whole set stale.
//
// It's code rather than a paragraph of prose for a caller to carry out,
// because a wrong answer here is silent: a stale digest read as current makes
// `fix` declare PASS over code nothing checked.
//
// Usage:   node reports-current.mjs <report-dir> <scope...>
//   <report-dir>  where `qoq --check --json` wrote its reports
//   <scope...>    files or directories the verdict is about; a bare `qoq fix`
//                 passes qoq.config's srcPath
//
// Exit code: 0 current (reuse them), 1 stale or missing (re-run the check),
// 2 usage error. Branch on the code; stdout is for humans reading a log.
// `check.mjs` imports `reportsCurrent` instead of spawning it.

import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPORTS = [
  'prettier-report.json',
  'eslint-report.json',
  'knip-report.json',
  'jscpd-report.json',
  'npm-report.json',
  'stylelint-report.json',
  'structurelint-report.json',
  'skillslint-report.json',
  'justify-disable-report.json',
];

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);

// Oldest report wins: one tool that didn't re-run leaves the set stale.
const oldestReport = (dir) => {
  const times = REPORTS.map((name) => join(dir, name))
    .filter(existsSync)
    .map((path) => statSync(path).mtimeMs);
  return times.length ? Math.min(...times) : undefined;
};

const newestSource = (paths) => {
  let newest = 0;
  for (const path of paths) {
    if (!existsSync(path)) {
      continue;
    }
    const stat = statSync(path);
    if (!stat.isDirectory()) {
      newest = Math.max(newest, stat.mtimeMs);
      continue;
    }
    for (const entry of readdirSync(path, { recursive: true, withFileTypes: true })) {
      if (entry.isDirectory() || SKIP.has(entry.name)) {
        continue;
      }
      // parentPath is Node >=20.12; name alone would lose the subdirectory.
      const full = join(entry.parentPath ?? entry.path, entry.name);
      if (full.split('/').some((part) => SKIP.has(part))) {
        continue;
      }
      newest = Math.max(newest, statSync(full).mtimeMs);
    }
  }
  return newest;
};

// `current: false` carries the reason a log line should say.
export const reportsCurrent = (reportDir, scope) => {
  const reports = oldestReport(reportDir);
  if (reports === undefined) {
    return { current: false, reason: `stale: no reports in ${reportDir}` };
  }
  if (newestSource(scope) >= reports) {
    return { current: false, reason: 'stale: a file in scope is newer than the reports' };
  }
  return { current: true, reason: 'current' };
};

// import.meta.url is realpath'd and argv[1] isn't, so compare real paths: through
// the .claude/skills/qoq symlink this block otherwise never runs.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const [reportDir, ...scope] = process.argv.slice(2);
  if (!reportDir || scope.length === 0) {
    process.stderr.write('usage: reports-current.mjs <report-dir> <scope...>\n');
    process.exit(2);
  }
  const { current, reason } = reportsCurrent(reportDir, scope);
  process.stdout.write(`${reason}\n`);
  process.exit(current ? 0 : 1);
}
