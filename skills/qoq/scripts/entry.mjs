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
//   - a workspace root has no record of its own. `fullstack-plan` always runs
//     at one, and `execute` does when it is handed a manifest there — a root
//     with no `qoq.config.*` and at least two child repos that have one. Both
//     get a `components` section instead, and each component's discovery runs
//     when its own track starts.
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
// Usage:   node entry.mjs --project <dir> --command <fix|refactor|bump|plan|fullstack-plan|replan|execute|test|compress>
//
// Exit code: always 0 — stdout is a section per check, each with what to do, or
// a single `command` section asking for one.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMANDS = [
  'fix',
  'refactor',
  'bump',
  'plan',
  'fullstack-plan',
  'replan',
  'execute',
  'test',
  'compress',
];
const ASKS_ON_INSTALL = ['fix', 'test', 'execute'];
const SKIPS_DISCOVERY = ['compress', 'fullstack-plan'];
const CONFIG_FILES = ['qoq.config.ts', 'qoq.config.js', 'qoq.config.cjs', 'qoq.config.mjs'];

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

const project = flag('project') ?? process.cwd();
const command = flag('command');
const script = (name) => fileURLToPath(new URL(name, import.meta.url));

// SKILL.md runs this through dynamic context injection, where any non-zero exit
// aborts the skill invocation. A missing or unknown command is the user's to
// settle, so it's a question on stdout — and nothing else runs, least of all
// stats.mjs, which would count a run that has no command yet.
if (!COMMANDS.includes(command)) {
  const given = command
    ? `\`${command}\` is not a command — one of ${COMMANDS.join(', ')}`
    : 'none given';
  process.stdout.write(
    `## command\n${given}.\nACTION: ask which command, never guess. Then run \`node ${script('entry.mjs')} --project ${project} --command <answer>\` yourself and do what it prints.\n`
  );
  process.exit(0);
}

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

  return 'ACTION: ask the user before carrying on — continue (every dispatch until Claude Code picks the directory up, about a minute, takes the general-purpose fallback printed in the agents section above), or exit and re-run with the agents registered. If they exit, stop here rather than running half the command.';
};

section('agents', ...agentLines, agentAction());

// 2. The record — or, at a workspace root, the components that each have one.
const hasConfig = (dir) => CONFIG_FILES.some((name) => existsSync(join(dir, name)));
const components = () =>
  readdirSync(project, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .filter((name) => hasConfig(join(project, name)) && existsSync(join(project, name, '.git')))
    .sort();

const found = command === 'fullstack-plan' || command === 'execute' ? components() : [];
const atWorkspaceRoot =
  command === 'fullstack-plan' ||
  (command === 'execute' && !hasConfig(project) && found.length >= 2);

const componentsAction = () => {
  if (found.length < 2) {
    return 'ACTION: a fullstack plan needs at least two components — say so and stop; one is a `plan` run inside it.';
  }

  // The manifest's Components table already settled the set.
  if (command === 'execute') {
    return "ACTION: nothing — the manifest's Components table says which take part; don't re-ask. Each one runs its own discovery when its track starts (references/fullstack-execute.md).";
  }

  return 'ACTION: confirm with the user which of these take part — never assume all of them. Each one runs its own discovery when its track starts (references/fullstack-plan.md).';
};

if (atWorkspaceRoot) {
  section(
    'components',
    found.length
      ? `candidates — child repos with their own qoq.config: ${found.join(', ')}`
      : 'none — no child directory has both its own qoq.config and its own .git.',
    componentsAction()
  );
}

if (SKIPS_DISCOVERY.includes(command) || atWorkspaceRoot) {
  const why = atWorkspaceRoot
    ? 'a workspace root has no record of its own; each component has one.'
    : `\`${command}\` reads nothing on the record.`;
  section('discovery', `skipped — ${why}`, 'ACTION: nothing.');
} else {
  const discovery = run('discovery-check.mjs');

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
      'ACTION: fill the record in yourself, on this thread, from the payload below — see references/discovery.md. `proposed` is already derived and wants checking, not re-deriving; `unresolved` is what you settle. Anything ambiguous is a question for the user, and the file stays unwritten until it is answered.',
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
