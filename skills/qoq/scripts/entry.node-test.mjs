// node --test skills/qoq/scripts/entry.node-test.mjs
//
// The contract is the exit code plus the sections on stdout, so the test drives
// the script as a subprocess. It composes three children that have their own
// specs — what is asserted here is only the sequencing this file owns.
//
// HOME points at a throwaway with stats declined, so no case reaches the real
// endpoint. The one thing that must never happen is a second send per run.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('entry.mjs', import.meta.url).pathname;

const DECLINED = "export default { stats: false, prettier: { sources: ['.'] } };\n";

const fixture = ({ cli = true } = {}) => {
  const project = mkdtempSync(join(tmpdir(), 'qoq-entry-'));
  writeFileSync(join(project, 'package.json'), '{"scripts":{"test":"vitest","build":"tsc"}}');
  writeFileSync(join(project, 'qoq.config.js'), DECLINED);
  if (cli) {
    mkdirSync(join(project, 'node_modules', '@ladamczyk', 'qoq-cli'), { recursive: true });
  }
  return project;
};

// A parent directory holding repos that each have their own qoq.config — the
// shape `fullstack-plan` runs from. The root itself has no config and no CLI.
const workspace = (names) => {
  const root = mkdtempSync(join(tmpdir(), 'qoq-entry-ws-'));
  for (const name of names) {
    mkdirSync(join(root, name, '.git'), { recursive: true });
    writeFileSync(join(root, name, 'qoq.config.js'), DECLINED);
  }
  return root;
};

const discoverySection = (stdout) => stdout.split('## discovery')[1]?.split('##')[0] ?? '';

const run = (project, command) =>
  spawnSync(process.execPath, [SCRIPT, '--project', project, '--command', command], {
    encoding: 'utf8',
    env: { ...process.env, HOME: mkdtempSync(join(tmpdir(), 'qoq-entry-home-')) },
  });

test('a run reports all three checks', () => {
  const { status, stdout } = run(fixture(), 'fix');

  assert.equal(status, 0);
  assert.match(stdout, /^## agents$/m);
  assert.match(stdout, /^## discovery$/m);
  assert.match(stdout, /^## stats$/m);
});

// The record is the whole point of the check; a caller that has to go and read
// the file itself is paying for the gate twice.
test('a stale record hands the payload to the caller', () => {
  const { stdout } = run(fixture(), 'fix');

  assert.match(stdout, /stale —/);
  assert.match(stdout, /fill the record in yourself/);
  assert.ok(stdout.includes('"proposed"'));
  assert.ok(stdout.includes('"unresolved"'));
});

// `compress` edits prose, runs no tool and dispatches no agent, so nothing on
// the record bears on it.
test('compress skips discovery', () => {
  const { status, stdout } = run(fixture(), 'compress');

  assert.equal(status, 0);
  assert.match(stdout, /## discovery\nskipped/);
  const [, afterHeading] = stdout.split('## discovery');
  const [discovery] = afterHeading.split('##');
  assert.doesNotMatch(discovery, /fill the record/);
});

// The rule that had drifted across three prose files. These three dispatch a
// pinned agent inside the window before Claude Code registers the directory.
test('a fresh install is a question for fix, test and execute', () => {
  for (const command of ['fix', 'test', 'execute']) {
    assert.match(run(fixture(), command).stdout, /ACTION: ask the user before carrying on/);
  }
});

// The deliberate exception: refactor opens with a fix, so its first checker does
// land in the window — and a question in front of a command whose next move is
// another command's question is noise.
test('refactor and the rest only report the install at the end', () => {
  for (const command of ['refactor', 'bump', 'plan', 'fullstack-plan', 'replan', 'compress']) {
    const { stdout } = run(fixture(), command);
    assert.match(stdout, /agents installed:/);
    assert.doesNotMatch(stdout, /ACTION: ask the user before carrying on/);
  }
});

// `replan` decomposes, so it reads the record for the same reasons `plan` does.
// It is the one thing that would have made it plausible to skip discovery.
test('replan reads the record like plan does', () => {
  const { status, stdout } = run(fixture(), 'replan');

  assert.equal(status, 0);
  assert.doesNotMatch(stdout, /## discovery\nskipped/);
});

// A workspace root has no record of its own: every command field belongs to a
// component, and is read from that component's record when its track starts.
test('fullstack-plan lists the components and skips discovery', () => {
  const { status, stdout } = run(workspace(['fe', 'be']), 'fullstack-plan');

  assert.equal(status, 0);
  assert.match(stdout, /^## components$/m);
  assert.match(stdout, /be, fe/);
  assert.match(stdout, /confirm with the user/);
  assert.match(discoverySection(stdout), /^\nskipped/);
});

// One component is a `plan` inside it, not a fullstack plan.
test('fullstack-plan with fewer than two components says to stop', () => {
  const { stdout } = run(workspace(['be']), 'fullstack-plan');

  assert.match(stdout, /needs at least two components/);
});

// A sibling directory without its own repo can't be a track: its commits would
// land in someone else's index.
test('a child without its own .git is not a component', () => {
  const root = workspace(['be', 'fe']);
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'docs', 'qoq.config.js'), DECLINED);

  assert.doesNotMatch(run(root, 'fullstack-plan').stdout, /docs/);
});

// `execute` handed a manifest runs at the same root, so it skips the same way.
test('execute at a workspace root skips discovery and lists the components', () => {
  const { stdout } = run(workspace(['fe', 'be']), 'execute');

  assert.match(stdout, /^## components$/m);
  assert.match(discoverySection(stdout), /^\nskipped/);
});

// A qoq project that merely contains sub-repos is still a qoq project.
test('execute in a project with its own config reads the record as before', () => {
  const root = workspace(['fe', 'be']);
  writeFileSync(join(root, 'qoq.config.js'), DECLINED);
  writeFileSync(join(root, 'package.json'), '{"scripts":{"test":"vitest","build":"tsc"}}');

  const { stdout } = run(root, 'execute');
  assert.doesNotMatch(stdout, /^## components$/m);
  assert.doesNotMatch(discoverySection(stdout), /^\nskipped/);
});

// One child repo is not a workspace: execute falls through to today's path.
test('execute at a root with one component is not a workspace run', () => {
  const { stdout } = run(workspace(['be']), 'execute');

  assert.doesNotMatch(stdout, /^## components$/m);
});

// The CLI is a constant this skill assumes, not something entry discovers: a
// project without it runs the same three checks as any other.
test('the CLI is not a head-of-run check', () => {
  const { status, stdout } = run(fixture({ cli: false }), 'fix');

  assert.equal(status, 0);
  assert.doesNotMatch(stdout, /STOP:/);
});

// SKILL.md injects this script's output, and a non-zero exit there aborts the
// whole skill invocation — so a missing command is a question, not an error.
test('a missing or unknown command asks, runs nothing, and exits 0', () => {
  for (const command of [[], ['--command', ''], ['--command', 'lint']]) {
    const { status, stdout } = spawnSync(
      process.execPath,
      [SCRIPT, '--project', fixture(), ...command],
      {
        encoding: 'utf8',
      }
    );
    assert.equal(status, 0);
    assert.match(stdout, /^## command$/m);
    assert.match(stdout, /ACTION: ask which command/);
    assert.doesNotMatch(stdout, /^## (agents|discovery|stats)$/m);
  }
});
