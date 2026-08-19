#!/usr/bin/env node
// The head of every top-level qoq run: agents, discovery record, usage stats.
//
// Three scripts already own those answers. This runs them in the one order that
// works and prints what the caller should do about each, so the branching lives
// here rather than in SKILL.md, which is loaded on every run of every command
// and was carrying two exit-code tables and a consent procedure to say it.
//
// It composes; it decides nothing they decide. Each child keeps its own
// contract and its own spec, and this file holds only the two rules that are
// genuinely about the sequence — both of which were previously stated in more
// than one prose file and had already drifted apart:
//
//   - `compress` skips discovery. It edits prose, runs no tool and dispatches no
//     agent, so nothing on the record bears on it. (It ends by calling `qoq
//     fix`, which does its own discovery: deferred, not skipped.)
//   - a fresh agent install is a question for `fix`, `test` and `execute`, and a
//     line in the end-of-run notice for everything else. Those three dispatch a
//     pinned agent inside the window before Claude Code registers the directory,
//     so their first dispatch can land on the `general-purpose` fallback — and
//     for an agent whose contract is a restriction, the fallback is the
//     restriction gone. `refactor` is the deliberate exception: it opens with a
//     `fix`, so its first checker does land in that window, but putting a
//     question in front of a command whose next move is another command's
//     question is the noise this narrowing exists to remove.
//
// Usage:   node entry.mjs --project <dir> --command <fix|refactor|bump|plan|execute|test|compress>
//
// Exit code: 0 proceed — stdout is a section per check, each with what to do.
// 2 usage error. 3 stop the run: the qoq CLI isn't installed, and every
// command's spine is that binary.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const COMMANDS = ['fix', 'refactor', 'bump', 'plan', 'execute', 'test', 'compress'];
const ASKS_ON_INSTALL = ['fix', 'test', 'execute'];
const SKIPS_DISCOVERY = ['compress'];

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

const project = flag('project') ?? process.cwd();
const command = flag('command');

if (!COMMANDS.includes(command)) {
  process.stderr.write(`usage: entry.mjs --project <dir> --command <${COMMANDS.join('|')}>\n`);
  process.exit(2);
}

const script = (name) => fileURLToPath(new URL(name, import.meta.url));
const run = (name, ...extra) =>
  spawnSync(process.execPath, [script(name), '--project', project, ...extra], {
    encoding: 'utf8',
  });

const out = [];
const section = (title, ...body) => out.push(`## ${title}`, ...body, '');

// 1. Agents. First, because it is the only thing that notices a skill upgrade,
// and because whether to ask about one changes what the rest of the run does.
const agents = run('sync-agents.mjs');
const agentLines = agents.stdout.trim().split('\n').filter(Boolean);
const freshInstall = agentLines.some((line) => line.startsWith('agents installed:'));

const agentAction = () => {
  if (!freshInstall) {
    return 'ACTION: nothing.';
  }

  if (!ASKS_ON_INSTALL.includes(command)) {
    return 'ACTION: nothing now — report the install in the end-of-run notice.';
  }

  return 'ACTION: ask the user before carrying on — continue (every dispatch until Claude Code picks the directory up, about a minute, takes the general-purpose fallback in SKILL.md), or exit and re-run with the agents registered. If they exit, stop here rather than running half the command.';
};

section('agents', ...agentLines, agentAction());

// 2. The record.
if (SKIPS_DISCOVERY.includes(command)) {
  section('discovery', `skipped — \`${command}\` reads nothing on the record.`, 'ACTION: nothing.');
} else {
  const discovery = run('discovery-check.mjs');

  if (discovery.status === 3) {
    process.stderr.write(discovery.stderr);
    process.stdout.write(
      `${out.join('\n')}\n## discovery\nSTOP: ${discovery.stderr.trim()}. Every qoq command's spine is the CLI; without it they degrade into advice while still calling themselves a gate. Tell the user to install it and stop the run.\n`
    );
    process.exit(3);
  }

  if (discovery.status === 0) {
    section(
      'discovery',
      'current — the record follows. Dispatch nothing.',
      discovery.stdout.trim()
    );
  } else if (discovery.status === 1) {
    section(
      'discovery',
      `stale — ${discovery.stderr.trim()}`,
      'ACTION: dispatch `qoq-discovery` with the payload below. `proposed` is already derived and wants checking, not re-deriving; `unresolved` is what it has to settle itself. Branch on the one status word it returns and nothing else.',
      discovery.stdout.trim()
    );
  } else {
    section('discovery', `ERROR: ${discovery.stderr.trim()}`, 'ACTION: report this and stop.');
  }
}

// 3. Stats. Last, because a run that stops at discovery never happened. Exactly
// one invocation: stats.mjs posts as a side effect of being asked, so calling it
// twice to read its answer twice would double every count it exists to keep.
const stats = spawnSync(process.execPath, [script('stats.mjs'), command, '--project', project], {
  encoding: 'utf8',
});

section(
  'stats',
  stats.stdout.trim(),
  stats.status === 1
    ? `ACTION: ask with AskUserQuestion on the facts above, then \`node ${script('stats.mjs')} ${command} --project ${project} --consent yes|no\`.`
    : 'ACTION: nothing.'
);

process.stdout.write(`${out.join('\n')}\n`);
