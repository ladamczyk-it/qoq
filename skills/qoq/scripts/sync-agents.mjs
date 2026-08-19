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
// Runs at the head of every top-level run, before the discovery gate, because
// it is the only thing that notices a skill upgrade: the record's hash covers
// the project, and a new version of an agent moves nothing there. Comparing six
// small files costs nothing next to the discovery run that hashing them into the
// record used to trigger.
//
// Claude Code picks the directory up on its own, a short delay after the files
// land — measured here as slower than the same turn and faster than a minute, so
// a dispatch immediately after this runs can still miss. That's what the line it
// prints is for: the caller tells the user the agents arrived, and the
// `general-purpose` fallback in SKILL.md covers whatever fires before they
// register. Nothing here needs a restart, and nothing depends on the timing.
//
// This writes into the user's own repo, usually into a tracked directory, so it
// has to be able to tell its own last copy from a file the user edited. It
// can't do that by comparing against the current source — every skill upgrade
// makes an untouched copy differ too. So each install records the digest of what
// it wrote in `.qoq-agents.json` beside the files:
//
//   digest matches   → our copy, untouched. Overwrite it.
//   digest differs   → the user edited it. Leave it, and say so — silently
//                      reverting somebody's customisation on a routine run is
//                      the one thing this script must never do.
//
// No manifest at all is the one case that gets adopted rather than protected:
// it means an install that predates this file, which is every existing project
// on the first run after the upgrade that shipped it. Protecting those would
// freeze every one of them on the agent bodies it already had and never ship
// another, which is worse than the hazard. So the first run refreshes and
// records; every run after it can tell the difference.
//
// A symlinked target is left alone regardless. That's a checkout pointing at the
// source files deliberately, and overwriting it with a copy would silently
// freeze the next edit out of every dispatch.
//
// Usage:   node sync-agents.mjs [--project <dir>]
//   --project   project root (default: cwd)
//
// Exit 0 with one line on stdout, for the caller to pass through verbatim:
// `agents current`, `agents installed: <names>`, and/or `agents kept (edited
// here): <names>`. Exit 2 usage error.

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST = '.qoq-agents.json';

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

const digest = (contents) => createHash('sha256').update(contents).digest('hex').slice(0, 16);
const manifestPath = join(target, MANIFEST);

const tracked = existsSync(manifestPath);

let installedDigests = {};
if (tracked) {
  try {
    installedDigests = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    // A manifest that doesn't parse tells us nothing about what we wrote, so
    // every file falls to the "not ours" branch. Conservative in the right
    // direction: nothing is overwritten on a guess.
  }
}

const installed = [];
const kept = [];

for (const agent of agents) {
  const name = agent.replace(/\.md$/, '');
  const to = join(target, agent);
  const contents = readFileSync(join(source, agent));

  // lstat rather than existsSync: a dangling symlink doesn't exist by that test,
  // and copying through one writes to wherever it points.
  const existing = lstatSync(to, { throwIfNoEntry: false });

  if (existing?.isSymbolicLink()) {
    continue;
  }

  if (existing) {
    const onDisk = readFileSync(to);

    if (onDisk.equals(contents)) {
      installedDigests[agent] = digest(contents);
      continue;
    }

    if (tracked && installedDigests[agent] !== digest(onDisk)) {
      kept.push(name);
      continue;
    }
  }

  copyFileSync(join(source, agent), to);
  installedDigests[agent] = digest(contents);
  installed.push(name);
}

writeFileSync(manifestPath, `${JSON.stringify(installedDigests, undefined, 2)}\n`);

const lines = [];
if (installed.length) {
  lines.push(`agents installed: ${installed.join(', ')} — registered a moment later`);
}
if (kept.length) {
  lines.push(`agents kept (edited here, not overwritten): ${kept.join(', ')}`);
}
if (!lines.length) {
  lines.push('agents current');
}

process.stdout.write(`${lines.join('\n')}\n`);
