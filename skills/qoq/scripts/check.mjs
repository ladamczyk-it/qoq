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
// `foo:check` is how unrelated flags would quietly change the gate. `--json` is
// appended through `npm run qoq:check -- …`, which is why the script must be a
// single `qoq --check …` command.
//
// The ticket form (`--skip-knip`) doesn't run that script: it runs `qoq staged`
// over the scope, with the script's own flags forwarded, so a ticket pays for its
// files and not the repo's. Knip and npm-outdated are skipped there — Knip's
// answer is false mid-milestone, npm's is never about the ticket's files — and
// the milestone gate's full run is where both are true. A script flag `staged`
// doesn't take is no verdict rather than a gate quietly running something else.
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
// Usage:   node check.mjs <report-dir> [--skip-knip] [<scope...>]
//   run from the project root. <report-dir> is cli.yaml's `reports`.
//   <scope...>  files or directories the verdict is about; defaults to `.`.
//               In the full form it only decides reuse, so a wider scope is
//               never wrong, just re-runs more often. In the ticket form it is
//               what `staged` checks, and it is required.
//
// Exit code: 0 no findings, 3 findings, 2 no verdict (no `qoq:check`, a failed
// build, a CLI crash, or no reports at all). Findings are 3, not 1, because 1 is
// what node exits with when it can't start this script at all (a wrong path, a
// wrong working directory). Anything but 0 or 3 is no verdict, never PASS.

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
const [reportDir, ...given] = args.filter((a) => a !== '--skip-knip');
const scope = given.length ? given : ['.'];

const fail = (message) => {
  process.stderr.write(`qoq check: ${message}\n`);
  process.exit(2);
};

if (!reportDir) {
  fail('usage: check.mjs <report-dir> [--skip-knip] [<scope...>]');
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

// `qoq --check` plus the flags `qoq staged` also takes; anything else can't be
// forwarded faithfully.
const stagedArgs = (body) => {
  const [bin, ...tokens] = body.trim().split(/\s+/);
  const out = new Set(['--json', '--skip-knip', '--skip-npm']);
  if (bin !== 'qoq' || !tokens.includes('--check')) {
    fail(
      `the ticket gate needs "qoq:check" to be a single \`qoq --check …\` command, got: ${body}`
    );
  }
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '--check') {
      continue;
    }
    if (
      /^--skip-[a-z-]+$/.test(token) ||
      ['--disable-cache', '--no-config-hints', '--silent'].includes(token)
    ) {
      out.add(token);
    } else if (token === '--concurrency' && tokens[i + 1]) {
      out.add(`--concurrency=${tokens[++i]}`);
    } else if (token.startsWith('--concurrency=')) {
      out.add(token);
    } else {
      fail(
        `"qoq:check" flag ${token} has no \`qoq staged\` equivalent, so the ticket gate can't run it.`
      );
    }
  }
  return [...out];
};

const mode = skipKnip ? 'ticket' : 'full';
const forwarded = skipKnip ? stagedArgs(script) : [];

if (skipKnip && !given.length) {
  fail("the ticket form needs the ticket's files: check.mjs <report-dir> --skip-knip <file...>");
}
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

  const run = skipKnip
    ? spawnSync('npx', ['--no', 'qoq', 'staged', ...forwarded, ...given], { stdio: 'ignore' })
    : spawnSync('npm', ['run', '-s', 'qoq:check', '--', '--json'], { stdio: 'ignore' });
  if (run.status !== 0 && run.status !== 1) {
    crashed = run.status ?? run.signal;
  } else if (existsSync(reportDir)) {
    writeFileSync(markerPath, `${JSON.stringify({ mode, script })}\n`);
  }
}

const header = `gate: qoq:check → ${script}${
  skipKnip ? ` → qoq staged ${forwarded.join(' ')} <scope> (ticket: knip, npm skipped)` : ''
}${reuse ? ' (reports reused)' : ''}\n`;
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
process.exit(code === 1 ? 3 : code);
