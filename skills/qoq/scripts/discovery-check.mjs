#!/usr/bin/env node
// Is the discovery record still good for this project?
//
// Every qoq command starts from the record. Dispatching `qoq-discovery` to
// re-verify it on every run costs an agent and a dozen file reads to confirm
// something nothing has touched, so this is the cheap gate in front of it: the
// record carries a hash of the three inputs its answers came from — package.json,
// the lockfile, and the skill's own agent files — and a matching hash means
// nothing it describes has moved.
//
// package.json as well as the lockfile. The lockfile is the dependency tree the
// record's flags and CLI invocation were derived for; package.json holds the
// scripts every other field quotes verbatim, and renaming one of those changes
// no lockfile at all — the record would keep naming a script that no longer
// exists.
//
// A script rather than prose for the caller to carry out, because "has this
// project moved" has to mean one thing. Two callers eyeballing a lockfile will
// disagree, and the failure is silent: a stale record is read as current and
// every command after it runs on answers for a project that's gone.
//
// The skill's own agent files are in the hash as well, because discovery is what
// copies them into the project's .claude/agents/ (its step 5,
// scripts/sync-agents.mjs). A skill upgrade that ships a changed agent moves
// nothing in the project, so without them the project would keep dispatching
// whichever version happened to land first until a dependency moved for
// unrelated reasons.
//
// What the hash does NOT cover: which review lenses are installed, and where
// they resolve from. Those live in the caller's context and in no file here, so
// installing or moving a lens leaves the hash matching and the `skills` field
// wrong. Edit the field or delete the record to force a re-derive — the note in
// references/discovery.md says so to the user in as many words.
//
// Usage:   node discovery-check.mjs [--project <dir>]
//   --project   project root (default: cwd)
//
// Exit code: 0 the record is current — its JSON is on stdout, use it and
// dispatch nothing. 1 missing, unreadable, or derived from a different project
// state — stdout is the hash the fresh record must carry, stderr says which it
// was. 2 usage error.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RECORD = ['node_modules', '@ladamczyk', 'qoq-cli', 'bin', 'qoq-skill-discovery.json'];

// package.json is always in the hash — it's where the recorded scripts come
// from. Then the first lockfile present, for the dependency tree those answers
// were derived against. A project with no lockfile still hashes cleanly.
const HASHED = [
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
];

const args = process.argv.slice(2);
const projectIndex = args.indexOf('--project');
const project = projectIndex === -1 ? process.cwd() : args[projectIndex + 1];

if (!project || args.some((arg) => arg.startsWith('--') && arg !== '--project')) {
  process.stderr.write('usage: discovery-check.mjs [--project <dir>]\n');
  process.exit(2);
}

const hashed = HASHED.map((name) => join(project, name)).filter((path) => existsSync(path));

if (!hashed.length) {
  process.stderr.write(`no package.json in ${project}\n`);
  process.exit(2);
}

// Only the first lockfile counts: a repo carrying two of them would otherwise
// hash differently depending on which package manager last ran.
const [manifest, ...locks] = hashed;
const digest = createHash('sha256');
for (const path of [manifest, ...locks.slice(0, 1)]) {
  digest.update(readFileSync(path));
}

// Sorted, so the digest doesn't depend on the order the filesystem hands them
// back — two machines reading the same skill have to agree.
const agents = join(fileURLToPath(new URL('../agents/', import.meta.url)));
for (const name of readdirSync(agents)
  .filter((file) => file.endsWith('.md'))
  .sort()) {
  digest.update(readFileSync(join(agents, name)));
}

const hash = digest.digest('hex').slice(0, 16);

const stale = (reason) => {
  process.stderr.write(`${reason}\n`);
  process.stdout.write(`${hash}\n`);
  process.exit(1);
};

const recordPath = join(project, ...RECORD);

if (!existsSync(recordPath)) {
  stale('no discovery record');
}

let record;
try {
  record = JSON.parse(readFileSync(recordPath, 'utf8'));
} catch {
  // A record that doesn't parse is worse than none: whoever reads it next will
  // read half of it. Treat it as absent and let discovery overwrite.
  stale('discovery record is not valid JSON');
}

if (record.hash !== hash) {
  stale(
    `a hashed input changed — package.json, the lockfile, or the skill's agents ` +
      `(record ${record.hash ?? 'unhashed'}, now ${hash})`
  );
}

process.stdout.write(`${JSON.stringify(record, undefined, 2)}\n`);
