#!/usr/bin/env node
// QoQ workspace lifecycle: one script owns the `.qoq/` scratch directory so no
// command re-implements (and no two commands drift on) the same ritual. It
// exists because the prose version of this procedure — mkdir, edit .gitignore,
// remember whether you created or appended, revert in the right order at the
// end — was duplicated across five reference files and is exactly the kind of
// multi-step state-tracking an agent fumbles under long context. The script
// makes it mechanical.
//
// Usage:
//   node workspace.mjs init                  create .qoq/, ignore it, record state
//   node workspace.mjs snapshot [-- <paths>] record a restore point for the
//                                            current tree: `git stash create`
//                                            for tracked changes PLUS a copy of
//                                            untracked files into .qoq/snapshot/
//                                            (git stash create does NOT capture
//                                            untracked files — without the copy,
//                                            a fix regressing a freshly created
//                                            file cannot be rolled back)
//   node workspace.mjs commands              print the cached validation
//                                            commands (lint/test/build), or
//                                            `null` if discovery hasn't run yet
//   node workspace.mjs commands --set <json> cache the discovered validation
//                                            commands so later phases — or a
//                                            resumed run against a leftover
//                                            workspace — read them instead of
//                                            re-discovering (and possibly
//                                            re-asking an ambiguity question)
//   node workspace.mjs cleanup               remove .qoq/ and revert .gitignore
//
// State lives in .qoq/.workspace.json (gitignore disposition, snapshot ref,
// cached validation commands). `stage-patch.mjs` reads the snapshot ref from
// there as its default restore point. Exit codes: 0 ok, 1 git failure, 2 usage
// error.

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const BEGIN = '# --- QoQ workspace (temporary; removed by workspace.mjs cleanup) ---';
const END = '# --- end QoQ workspace ---';
const BLOCK = `${BEGIN}\n.qoq/\n${END}\n`;
// When we CREATE .gitignore ourselves, the untracked file would itself be
// `git status` noise for the whole run — so that variant also self-ignores.
// Cleanup deletes the file, so the entry never outlives the run.
const BLOCK_CREATED = `${BEGIN}\n.qoq/\n/.gitignore\n${END}\n`;

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

let root;
try {
  root = git('rev-parse', '--show-toplevel').trim();
} catch {
  process.stderr.write('workspace.mjs: not inside a git repository\n');
  process.exit(1);
}
process.chdir(root);

const WORKSPACE = '.qoq';
const STATE_PATH = join(WORKSPACE, '.workspace.json');
const readState = () => {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
};
const writeState = (patch) =>
  writeFileSync(STATE_PATH, `${JSON.stringify({ ...readState(), ...patch }, null, 2)}\n`);

const [command, ...rest] = process.argv.slice(2);

const init = () => {
  mkdirSync(join(WORKSPACE, 'reports'), { recursive: true });
  // Self-ignore as a fallback: even if the root .gitignore edit is lost, git
  // never lists the workspace as untracked.
  writeFileSync(join(WORKSPACE, '.gitignore'), '*\n');

  // Root .gitignore: needed on top of the self-ignore because Prettier 3 walks
  // the tree honoring the ROOT .gitignore — without this entry it treats the
  // workspace's generated files as unformatted source and turns the gate red.
  let disposition = 'untouched';
  if (!existsSync('.gitignore')) {
    writeFileSync('.gitignore', BLOCK_CREATED);
    disposition = 'created';
  } else {
    const current = readFileSync('.gitignore', 'utf8');
    if (!current.includes(BEGIN)) {
      writeFileSync('.gitignore', `${current}${current.endsWith('\n') ? '' : '\n'}${BLOCK}`);
      disposition = 'appended';
    }
  }
  const state = readState();
  // Idempotent re-init must not overwrite the original disposition, or cleanup
  // would revert the wrong thing.
  writeState({ gitignore: state.gitignore ?? disposition });
  process.stdout.write(`.qoq/ ready (gitignore: ${state.gitignore ?? disposition})\n`);
};

const snapshot = () => {
  const sep = rest.indexOf('--');
  const paths = sep === -1 ? [] : rest.slice(sep + 1);

  // Tracked changes: `git stash create` snapshots them into a dangling commit
  // without touching the tree. Prints nothing when the tree is clean → HEAD is
  // the restore point.
  const ref = git('stash', 'create', 'qoq snapshot').trim() || 'HEAD';

  // Untracked files are NOT in that commit — copy them aside so they are
  // restorable too. Scoped to <paths> when given, else the whole tree.
  const untracked = git(
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
    '--',
    ...(paths.length ? paths : ['.'])
  )
    .split('\0')
    .filter((f) => f && !f.startsWith(`${WORKSPACE}/`));
  for (const file of untracked) {
    const dest = join(WORKSPACE, 'snapshot', file);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(file, dest);
  }

  writeState({ snapshotRef: ref, snapshotUntracked: untracked });
  const untrackedNote = untracked.length
    ? ` + ${untracked.length} untracked file(s) in .qoq/snapshot/`
    : '';
  process.stdout.write(`snapshot: ${ref}${untrackedNote}\n`);
};

const cleanup = () => {
  // Read state BEFORE deleting the directory it lives in.
  const state = readState();
  // Remove the workspace first, then revert the ignore rule — this order means
  // the directory is gone by the time it stops being ignored, so it never
  // flashes back into `git status`.
  rmSync(WORKSPACE, { recursive: true, force: true });

  if (existsSync('.gitignore')) {
    const current = readFileSync('.gitignore', 'utf8');
    const begin = current.indexOf(BEGIN);
    if (begin !== -1) {
      const end = current.indexOf(END);
      const after = end === -1 ? current.length : end + END.length;
      const stripped = (current.slice(0, begin) + current.slice(after)).replace(/\n{3,}/g, '\n\n');
      if (state.gitignore === 'created' && stripped.trim() === '') {
        unlinkSync('.gitignore');
      } else {
        writeFileSync('.gitignore', `${stripped.trimEnd()}\n`);
      }
    }
  }
  process.stdout.write('.qoq/ removed, .gitignore reverted\n');
};

const commandsCmd = () => {
  if (rest[0] !== '--set') {
    const { commands: cached } = readState();
    process.stdout.write(`${JSON.stringify(cached ?? null)}\n`);
    return;
  }
  const [, json] = rest;
  if (!json) {
    process.stderr.write('usage: workspace.mjs commands --set <json>\n');
    process.exit(2);
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    process.stderr.write(`workspace.mjs commands: invalid JSON — ${err.message}\n`);
    process.exit(2);
  }
  writeState({ commands: parsed });
  process.stdout.write(`${JSON.stringify(parsed)}\n`);
};

const handlers = { init, snapshot, commands: commandsCmd, cleanup };
if (!handlers[command]) {
  process.stderr.write(
    'usage: workspace.mjs <init | snapshot [-- <paths…>] | commands [--set <json>] | cleanup>\n'
  );
  process.exit(2);
}
try {
  handlers[command]();
} catch (err) {
  process.stderr.write(`workspace.mjs ${command}: ${err?.message ?? err}\n`);
  process.exit(1);
}
