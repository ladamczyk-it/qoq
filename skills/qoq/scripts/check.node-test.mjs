// node --test skills/qoq/scripts/check.node-test.mjs
//
// Drives check.mjs as the fix thread does: a subprocess at the project root. The
// project is a temp dir whose `qoq` bin is a fake that logs its argv and writes
// whatever reports `fake.json` asks for, so every branch runs in milliseconds.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('check.mjs', import.meta.url).pathname;
const REPORTS = 'reports';

const FAKE_QOQ = `#!/usr/bin/env node
const fs = require('node:fs');
const cfg = JSON.parse(fs.readFileSync('fake.json', 'utf8'));
fs.appendFileSync('calls.log', process.argv.slice(2).join(' ') + '\\n');
fs.mkdirSync('${REPORTS}', { recursive: true });
for (const [name, body] of Object.entries(cfg.write ?? {})) {
  fs.writeFileSync('${REPORTS}/' + name, JSON.stringify(body));
}
process.exit(cfg.exit ?? 0);
`;

const CLEAN = { 'prettier-report.json': [] };
const ESLINT_FINDING = {
  'eslint-report.json': [
    { filePath: 'src/a.ts', messages: [{ ruleId: 'no-var', severity: 2, line: 1 }] },
  ],
};

const project = ({ qoqCheck = 'qoq --check', fake = { write: CLEAN }, scripts = {} } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'check-'));
  const pkgScripts = { ...scripts };
  if (qoqCheck) {
    pkgScripts['qoq:check'] = qoqCheck;
  }
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: pkgScripts }));
  writeFileSync(join(dir, 'fake.json'), JSON.stringify(fake));
  mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
  writeFileSync(join(dir, 'node_modules', '.bin', 'qoq'), FAKE_QOQ);
  chmodSync(join(dir, 'node_modules', '.bin', 'qoq'), 0o755);
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1;\n');
  // Source older than any report written from here on.
  utimesSync(join(dir, 'src', 'a.ts'), new Date(2000, 0, 1), new Date(2000, 0, 1));
  return dir;
};

const check = (dir, ...extra) =>
  spawnSync(process.execPath, [SCRIPT, REPORTS, ...extra, 'src'], { cwd: dir, encoding: 'utf8' });

const calls = (dir) =>
  existsSync(join(dir, 'calls.log'))
    ? readFileSync(join(dir, 'calls.log'), 'utf8').trim().split('\n')
    : [];

test('no qoq:check script is no verdict, and says what to add', () => {
  const dir = project({ qoqCheck: null, scripts: { lint: 'qoq --check' } });
  const { status, stderr } = check(dir);
  assert.equal(status, 2);
  assert.match(stderr, /"qoq:check": "qoq --check"/);
  assert.deepEqual(calls(dir), [], 'another script that runs qoq is never used');
});

test('stale reports run the project script with --json appended', () => {
  const dir = project({ qoqCheck: 'qoq --check --skip-npm' });
  const { status, stdout } = check(dir);
  assert.equal(status, 0, stdout);
  assert.deepEqual(calls(dir), ['--check --skip-npm --json']);
  assert.match(stdout, /gate: qoq:check → qoq --check --skip-npm\n/);
  assert.match(stdout, /No findings/);
});

test('findings exit 1 with the digest', () => {
  const dir = project({ fake: { exit: 1, write: ESLINT_FINDING } });
  const { status, stdout } = check(dir);
  assert.equal(status, 1);
  assert.match(stdout, /ESLINT/);
});

test('fresh reports written by the same mode and script are reused', () => {
  const dir = project();
  check(dir);
  const { status, stdout } = check(dir);
  assert.equal(status, 0);
  assert.equal(calls(dir).length, 1);
  assert.match(stdout, /reports reused/);
});

test('a changed script body or mode re-runs', () => {
  const dir = project();
  check(dir);
  check(dir, '--skip-knip');
  assert.equal(calls(dir).length, 2, 'ticket after full');
  assert.equal(calls(dir)[1], '--check --json --skip-knip');

  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  pkg.scripts['qoq:check'] = 'qoq --check --skip-npm';
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  check(dir, '--skip-knip');
  assert.equal(calls(dir).length, 3, 'new script body');
});

test('a report from an earlier run is gone after a run that skipped its tool', () => {
  const dir = project({ fake: { exit: 1, write: ESLINT_FINDING } });
  check(dir);
  writeFileSync(join(dir, 'fake.json'), JSON.stringify({ write: CLEAN }));
  writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 2;\n');
  const { status, stdout } = check(dir);
  assert.equal(status, 0, stdout);
  assert.doesNotMatch(stdout, /ESLINT/);
});

test('the ticket form says knip was skipped', () => {
  const { stdout } = check(project(), '--skip-knip');
  assert.match(stdout, /knip skipped/);
});

test('a CLI crash is no verdict, with the partial digest under a crash header', () => {
  const dir = project({ fake: { exit: 2, write: ESLINT_FINDING } });
  const { status, stdout } = check(dir);
  assert.equal(status, 2);
  assert.match(stdout, /qoq CLI crashed \(exit 2\)/);
  assert.match(stdout, /ESLINT/);
  // Nothing written by a crashed run may be reused.
  writeFileSync(join(dir, 'fake.json'), JSON.stringify({ write: CLEAN }));
  check(dir);
  assert.equal(calls(dir).length, 2);
});

test('a symlinked CLI is built before the gate runs', () => {
  const dir = project({
    scripts: { build: "node -e \"require('fs').writeFileSync('built','')\"" },
  });
  mkdirSync(join(dir, 'node_modules', '@ladamczyk'), { recursive: true });
  symlinkSync(join(dir, 'src'), join(dir, 'node_modules', '@ladamczyk', 'qoq-cli'));
  assert.equal(check(dir).status, 0);
  assert.ok(existsSync(join(dir, 'built')));
});

test('a failed build is no verdict', () => {
  const dir = project({ scripts: { build: 'exit 1' } });
  mkdirSync(join(dir, 'node_modules', '@ladamczyk'), { recursive: true });
  symlinkSync(join(dir, 'src'), join(dir, 'node_modules', '@ladamczyk', 'qoq-cli'));
  const { status, stderr } = check(dir);
  assert.equal(status, 2);
  assert.match(stderr, /npm run build/);
  assert.deepEqual(calls(dir), []);
});

test('no scope means the whole project, not a usage error', () => {
  const dir = project();
  const bare = spawnSync(process.execPath, [SCRIPT, REPORTS], { cwd: dir, encoding: 'utf8' });
  assert.equal(bare.status, 0, bare.stderr);
  assert.deepEqual(calls(dir), ['--check --json']);
});
