#!/usr/bin/env node
// QoQ workspace lifecycle: one script owns the `.qoq/` scratch directory so no
// command re-implements (and no two commands drift on) the same ritual. It
// exists because the prose version of this procedure — mkdir, edit .gitignore,
// remember whether you created or appended, revert in the right order at the
// end — was duplicated across five reference files and is exactly the kind of
// multi-step state-tracking an agent fumbles under long context. The script
// makes it mechanical.
//
// Usage (every command takes `--run <id>`, default `default`):
//   node workspace.mjs init     --run <id>   create .qoq/runs/<id>/, ignore the
//                                            workspace, record state
//   node workspace.mjs snapshot --run <id> [-- <paths>]
//                                            record a restore point for the
//                                            current tree: `git stash create`
//                                            for tracked changes PLUS a copy of
//                                            untracked files into
//                                            .qoq/runs/<id>/snapshot/
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
//   node workspace.mjs cleanup  --run <id>   remove this run's directory; remove
//                                            .qoq/ and revert .gitignore only
//                                            once no other run is still open
//
// WHY RUNS ARE ISOLATED. `.qoq/` used to be one flat directory that every
// invocation created and every cleanup deleted. That is fine for a human at a
// terminal, and corrupting for a plan executor: a wave of subagents each runs
// `gate`/`refactor` in the same repo at the same time, and the first one to
// finish would `rm -rf .qoq/` out from under the others — taking with it the
// snapshot copies that are the ONLY way back for a freshly created file whose
// fix regressed. Per-run directories mean a cleanup can only ever destroy its
// own state, and the shared parts (the .gitignore entry, the validation-command
// cache) survive until the last run closes.
//
// State is split accordingly:
//   .qoq/.workspace.json          shared — gitignore disposition, cached commands
//   .qoq/runs/<id>/.workspace.json  per-run — snapshot ref, untracked copies
// `stage-patch.mjs --dir .qoq/runs/<id>` reads the snapshot ref from the latter
// as its default restore point. Exit codes: 0 ok, 1 git failure, 2 usage error.

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
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
const RUNS = join(WORKSPACE, 'runs');
const SHARED_STATE = join(WORKSPACE, '.workspace.json');

const [command, ...rest] = process.argv.slice(2);

// `--run <id>` names this invocation's private directory. Callers that share a
// repo concurrently MUST pass distinct ids (a plan executor uses the ticket id);
// a lone human can ignore the flag and get the single `default` run.
const runId = (() => {
  const i = rest.indexOf('--run');
  const id = i === -1 ? 'default' : rest[i + 1];
  if (!id || /[/\\]/.test(id) || id.startsWith('.')) {
    process.stderr.write(`workspace.mjs: invalid --run id "${id ?? ''}"\n`);
    process.exit(2);
  }
  return id;
})();
const RUN_DIR = join(RUNS, runId);

const read = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
};
const write = (path, patch) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...read(path), ...patch }, null, 2)}\n`);
};
const readState = () => read(join(RUN_DIR, '.workspace.json'));
const writeState = (patch) => write(join(RUN_DIR, '.workspace.json'), patch);
const readShared = () => read(SHARED_STATE);
const writeShared = (patch) => write(SHARED_STATE, patch);

const init = () => {
  mkdirSync(join(RUN_DIR, 'reports'), { recursive: true });
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
  // The disposition is SHARED: whichever run appended the block, the last run
  // to clean up is the one that reverts it, and it has to know what to revert
  // to. Idempotent re-init must not overwrite the original, or cleanup would
  // revert the wrong thing.
  const shared = readShared();
  writeShared({ gitignore: shared.gitignore ?? disposition });
  process.stdout.write(
    `${RUN_DIR}/ ready (gitignore: ${shared.gitignore ?? disposition})\n`
  );
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
    const dest = join(RUN_DIR, 'snapshot', file);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(file, dest);
  }

  writeState({ snapshotRef: ref, snapshotUntracked: untracked });
  const untrackedNote = untracked.length
    ? ` + ${untracked.length} untracked file(s) in ${RUN_DIR}/snapshot/`
    : '';
  process.stdout.write(`snapshot: ${ref}${untrackedNote}\n`);
};

const cleanup = () => {
  // Read the shared state BEFORE anything gets deleted.
  const shared = readShared();
  rmSync(RUN_DIR, { recursive: true, force: true });

  // Another run still open? Then this cleanup is done: the shared workspace and
  // the .gitignore entry belong to whoever is still using them. Tearing them
  // down here is precisely the corruption per-run directories exist to prevent.
  const remaining = existsSync(RUNS) ? readdirSync(RUNS) : [];
  if (remaining.length) {
    process.stdout.write(
      `${RUN_DIR}/ removed; .qoq/ kept — ${remaining.length} run(s) still open: ${remaining.join(', ')}\n`
    );
    return;
  }

  // Last one out. Remove the workspace first, then revert the ignore rule — this
  // order means the directory is gone by the time it stops being ignored, so it
  // never flashes back into `git status`.
  rmSync(WORKSPACE, { recursive: true, force: true });

  if (existsSync('.gitignore')) {
    const current = readFileSync('.gitignore', 'utf8');
    // Strip EVERY block, not just the first: two runs racing in `init` can both
    // pass the "already present?" check and append. Removing all of them makes
    // that race self-healing instead of leaving a stale entry behind forever.
    let stripped = current;
    for (;;) {
      const begin = stripped.indexOf(BEGIN);
      if (begin === -1) break;
      const end = stripped.indexOf(END, begin);
      const after = end === -1 ? stripped.length : end + END.length;
      stripped = stripped.slice(0, begin) + stripped.slice(after);
    }
    if (stripped !== current) {
      stripped = stripped.replace(/\n{3,}/g, '\n\n');
      if (shared.gitignore === 'created' && stripped.trim() === '') {
        unlinkSync('.gitignore');
      } else {
        writeFileSync('.gitignore', `${stripped.trimEnd()}\n`);
      }
    }
  }
  process.stdout.write('.qoq/ removed, .gitignore reverted\n');
};

// The validation commands are a property of the REPO, not of a run, so they
// live in shared state: every run in a wave reads the discovery the first one
// paid for, and nobody re-asks an ambiguity question already answered.
const commandsCmd = () => {
  const setAt = rest.indexOf('--set');
  if (setAt === -1) {
    const { commands: cached } = readShared();
    process.stdout.write(`${JSON.stringify(cached ?? null)}\n`);
    return;
  }
  const json = rest[setAt + 1];
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
  writeShared({ commands: parsed });
  process.stdout.write(`${JSON.stringify(parsed)}\n`);
};

const handlers = { init, snapshot, commands: commandsCmd, cleanup };
if (!handlers[command]) {
  process.stderr.write(
    'usage: workspace.mjs <init | snapshot [-- <paths…>] | commands [--set <json>] | cleanup> [--run <id>]\n'
  );
  process.exit(2);
}
try {
  handlers[command]();
} catch (err) {
  process.stderr.write(`workspace.mjs ${command}: ${err?.message ?? err}\n`);
  process.exit(1);
}
