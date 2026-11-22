#!/usr/bin/env node
// The gate: the project's own `qoq:check`, turned into one digest.
//
// This replaced the `qoq-checker` agent, whose whole job was copying commands:
// decide whether the reports are current, run the check if they aren't, print
// the digest. A script does that the same way every time, runs at no model tier,
// and the agent's "never edit" guard isn't needed because nothing here edits source.
//
// The project's `qoq:check` script is the source of truth for what runs, so its
// `--skip-<tool>` flags hold. Only that name is read: guessing at `lint` or
// `foo:check` is how unrelated flags would quietly change the gate. `--json` (and
// `--skip-knip` for a ticket) is appended through `npm run qoq:check -- …`, which
// is why the script must be a single `qoq --check …` command.
//
// What it does that no npm script can:
//   - reuse: skips the run when the reports are newer than the scope, and the
//     marker says the same mode and script body wrote them. A ticket run leaves
//     no knip report, so a full verdict must never be built on it, and the other
//     way round
//   - empties the report files before a run. A tool the script skips writes no
//     report, and a leftover from an earlier run would put its stale findings
//     back in the digest
//   - builds first when the CLI is a workspace symlink, or the gate checks
//     yesterday's build
//   - a crash header: the CLI reports a thrown tool as a bare "Unknown error!"
//     and writes no report, so a tool with no section would otherwise read clean
//
// Usage:   node check.mjs <report-dir> [--skip-knip] <scope...>
//   run from the project root. <report-dir> is cli.yaml's `reports`.
//   <scope...>  files or directories the verdict is about
//
// Exit code: 0 no findings, 1 findings, 2 no verdict (no `qoq:check`, a failed
// build, a CLI crash, or no reports at all). Exit 2 is never PASS.

import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { reportsCurrent } from './reports-current.mjs';

const MARKER = '.qoq-check.json';
const SUMMARIZE = fileURLToPath(new URL('summarize.mjs', import.meta.url));
const LINK = join('node_modules', '@ladamczyk', 'qoq-cli');

const args = process.argv.slice(2);
const skipKnip = args.includes('--skip-knip');
const [reportDir, ...scope] = args.filter((a) => a !== '--skip-knip');

const fail = (message) => {
  process.stderr.write(`qoq check: ${message}\n`);
  process.exit(2);
};

if (!reportDir || scope.length === 0) {
  fail('usage: check.mjs <report-dir> [--skip-knip] <scope...>');
}

const script = existsSync('package.json')
  ? JSON.parse(readFileSync('package.json', 'utf8')).scripts?.['qoq:check']
  : undefined;

if (!script) {
  fail(
    'no "qoq:check" script in package.json. Add "qoq:check": "qoq --check" ' +
      '(with any --skip-<tool> flags the project wants) — the gate runs that script and no other.'
  );
}

const mode = skipKnip ? 'ticket' : 'full';
const markerPath = join(reportDir, MARKER);
const readMarker = () => {
  try {
    return JSON.parse(readFileSync(markerPath, 'utf8'));
  } catch {
    return undefined;
  }
};

const marker = readMarker();
const reuse =
  marker?.mode === mode && marker?.script === script && reportsCurrent(reportDir, scope).current;

let crashed;

if (!reuse) {
  if (existsSync(reportDir)) {
    for (const name of readdirSync(reportDir)) {
      if (name.endsWith('-report.json') || name === MARKER) {
        rmSync(join(reportDir, name), { force: true });
      }
    }
  }

  if (existsSync(LINK) && lstatSync(LINK).isSymbolicLink()) {
    const build = spawnSync('npm', ['run', 'build'], { stdio: 'ignore' });
    if (build.status !== 0) {
      fail(
        `\`npm run build\` failed (exit ${build.status}); the CLI is a workspace link and can't run unbuilt.`
      );
    }
  }

  const extra = skipKnip ? ['--json', '--skip-knip'] : ['--json'];
  const run = spawnSync('npm', ['run', '-s', 'qoq:check', '--', ...extra], { stdio: 'ignore' });
  if (run.status !== 0 && run.status !== 1) {
    crashed = run.status ?? run.signal;
  } else if (existsSync(reportDir)) {
    writeFileSync(markerPath, `${JSON.stringify({ mode, script })}\n`);
  }
}

const header = `gate: qoq:check → ${script}${skipKnip ? ' + --skip-knip (ticket: knip skipped)' : ''}${
  reuse ? ' (reports reused)' : ''
}\n`;
// Spawned, not imported: summarize.mjs is a top-level script, and its exit code
// (0 none, 1 findings, 2 no reports) is the verdict.
const digest = spawnSync(process.execPath, [SUMMARIZE, reportDir], { encoding: 'utf8' });
const text = `${digest.stdout}${digest.stderr}`;
const code = digest.status;

if (crashed !== undefined) {
  process.stdout.write(
    `${header}⚠ qoq CLI crashed (exit ${crashed}) — a tool with no section below did not run, it did not pass\n\n${text}`
  );
  process.exit(2);
}

(code === 2 ? process.stderr : process.stdout).write(`${header}${text}`);
process.exit(code);
