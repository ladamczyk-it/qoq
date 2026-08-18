#!/usr/bin/env node
// Install this skill's agents into the project's .claude/agents/.
//
// The six agent files live inside the skill, next to the references that
// dispatch them — but a skill registers no agents, and neither does a plugin
// that keeps them there. Claude Code loads plugin agents from real files in
// <plugin-root>/agents/ only: an "agents": [...] list in the manifest passes
// `claude plugin validate` and then loads nothing, and symlinks in that
// directory are skipped. So the skill installs them where the project's own
// agents live, and stays the single source of truth for their contents.
//
// Claude Code picks the directory up on its own, a short delay after the files
// land — measured here as slower than the same turn and faster than a minute, so
// a dispatch immediately after this runs can still miss. That's what the line it
// prints is for: the caller tells the user the agents arrived, and the
// `general-purpose` fallback in SKILL.md covers whatever fires before they
// register. Nothing here needs a restart, and nothing depends on the timing.
//
// A symlinked target is left alone. That's a checkout pointing at the source
// files deliberately, and overwriting it with a copy would silently freeze the
// next edit out of every dispatch.
//
// Usage:   node sync-agents.mjs [--project <dir>]
//   --project   project root (default: cwd)
//
// Exit 0 with one line on stdout, for the caller to pass through verbatim:
// `agents current`, or `agents installed: <names> — registered a moment later`.
// Exit 2 usage error.

import { copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const projectIndex = args.indexOf('--project');
const project = projectIndex === -1 ? process.cwd() : args[projectIndex + 1];

if (!project || args.some((arg) => arg.startsWith('--') && arg !== '--project')) {
  process.stderr.write('usage: sync-agents.mjs [--project <dir>]\n');
  process.exit(2);
}

const source = fileURLToPath(new URL('../agents/', import.meta.url));
const agents = readdirSync(source).filter((name) => name.endsWith('.md'));

if (!agents.length) {
  process.stderr.write(`no agent files in ${source}\n`);
  process.exit(2);
}

const target = join(project, '.claude', 'agents');
mkdirSync(target, { recursive: true });

const installed = [];

for (const agent of agents) {
  const to = join(target, agent);
  // lstat rather than existsSync: a dangling symlink doesn't exist by that test,
  // and copying through one writes to wherever it points.
  const existing = lstatSync(to, { throwIfNoEntry: false });
  if (existing?.isSymbolicLink()) {
    continue;
  }
  const contents = readFileSync(join(source, agent));
  if (existing && contents.equals(readFileSync(to))) {
    continue;
  }
  copyFileSync(join(source, agent), to);
  installed.push(agent.replace(/\.md$/, ''));
}

process.stdout.write(
  installed.length
    ? `agents installed: ${installed.join(', ')} — registered a moment later\n`
    : 'agents current\n'
);
