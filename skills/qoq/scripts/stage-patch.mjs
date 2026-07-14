#!/usr/bin/env node
// QoQ patch staging: capture the working tree's current edits to <paths> as a
// reviewable `git apply`-able patch, restore the tree, and verify the patch
// applies. One script instead of a four-step prose recipe, because the prose
// version had two silent failure modes an agent hits under pressure:
//
//   1. NEW files. Plain `git diff` ignores untracked files, so a patch meant to
//      "extract a shared helper" captured the two edited call sites and silently
//      dropped the new helper file. This script `git add -N`s new files first so
//      the diff carries them.
//   2. Wrong restore point. `git restore`/HEAD throws away any uncommitted work
//      the tree had before the run. This script restores to the snapshot ref
//      recorded by `workspace.mjs snapshot` (falling back to HEAD), and brings
//      back pre-existing untracked files from .qoq/snapshot/.
//
// Usage:
//   node stage-patch.mjs <name> [--dir .qoq] [--restore-to <ref>] [--no-restore] -- <paths…>
//
//   <name>          patch filename without extension (e.g. "complexity")
//   --dir           workspace directory (default .qoq)
//   --restore-to    restore point; default = snapshotRef from
//                   .qoq/.workspace.json, else HEAD
//   --no-restore    capture the patch but leave the edits in the tree (used
//                   when the change should stay applied, e.g. gate's safe tier)
//
// Exit codes: 0 staged (or nothing to stage), 1 git failure, 2 usage error,
// 3 the captured patch fails `git apply --check` — regenerate, never force.

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

let root;
try {
  root = git('rev-parse', '--show-toplevel').trim();
} catch {
  process.stderr.write('stage-patch.mjs: not inside a git repository\n');
  process.exit(1);
}
process.chdir(root);

const args = process.argv.slice(2);
const sep = args.indexOf('--');
const paths = sep === -1 ? [] : args.slice(sep + 1);
const opts = sep === -1 ? args : args.slice(0, sep);
const name = opts.find((a) => !a.startsWith('--'));
const flag = (f) => {
  const i = opts.indexOf(f);
  return i === -1 ? undefined : opts[i + 1];
};
const dir = flag('--dir') ?? '.qoq';
const noRestore = opts.includes('--no-restore');

if (!name || /[/\\]/.test(name) || paths.length === 0) {
  process.stderr.write(
    'usage: stage-patch.mjs <name> [--dir .qoq] [--restore-to <ref>] [--no-restore] -- <paths…>\n'
  );
  process.exit(2);
}

const state = (() => {
  try {
    return JSON.parse(readFileSync(join(dir, '.workspace.json'), 'utf8'));
  } catch {
    return {};
  }
})();
const restoreRef = flag('--restore-to') ?? state.snapshotRef ?? 'HEAD';

try {
  // Untracked files among <paths> fall into three cases, and getting them
  // wrong either loses a new file from the patch or claims the user's
  // pre-existing untracked work as this edit's doing:
  //   - brand-new (no snapshot copy)          → created by this edit:
  //     intent-to-add so `git diff <ref>` carries it as a new file.
  //   - pre-existing, unchanged since snapshot → not ours: leave invisible.
  //   - pre-existing, changed by this edit     → diff against its snapshot
  //     copy (the ref can't see untracked files), rewriting the header paths.
  const untracked = git('ls-files', '--others', '--exclude-standard', '-z', '--', ...paths)
    .split('\0')
    .filter(Boolean);
  const brandNew = [];
  const changedPreexisting = [];
  for (const file of untracked) {
    const copy = join(dir, 'snapshot', file);
    if (!existsSync(copy)) {
      brandNew.push(file);
    } else if (!readFileSync(copy).equals(readFileSync(file))) {
      changedPreexisting.push(file);
    }
  }
  if (brandNew.length) {
    git('add', '-N', '--', ...brandNew);
  }

  // Diff against the RESTORE POINT, not the index: on a dirty tree the index
  // still matches HEAD, so a plain `git diff` would bake the user's
  // pre-existing uncommitted changes into the patch — and the patch would no
  // longer apply once the tree is restored to the snapshot. Diffing against
  // the snapshot ref captures exactly this edit.
  let diff = git('diff', restoreRef, '--', ...paths);
  for (const file of changedPreexisting) {
    const copy = join(dir, 'snapshot', file);
    let chunk = '';
    try {
      git('diff', '--no-index', '--', copy, file);
    } catch (err) {
      chunk = err.stdout ?? ''; // --no-index exits 1 when the files differ
    }
    diff += chunk.replaceAll(`a/${copy}`, `a/${file}`);
  }

  if (!diff.trim()) {
    if (brandNew.length) {
      git('reset', '-q', '--', ...brandNew);
    }
    process.stdout.write(`nothing to stage for "${name}" — no changes under the given paths\n`);
    process.exit(0);
  }

  mkdirSync(dir, { recursive: true });
  const patchPath = join(dir, `${name}.patch`);
  writeFileSync(patchPath, diff);

  if (!noRestore) {
    // The set of files to restore comes from the patch itself (not from a
    // fresh `git diff` — the intent-to-add reset below would hide new files
    // from it). `--numstat` lists every touched file without applying.
    const files = git('apply', '--numstat', patchPath)
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('\t')[2]);
    // Undo the intent-to-add entries before touching the files, so the index
    // ends exactly as it started.
    if (brandNew.length) {
      git('reset', '-q', '--', ...brandNew);
    }
    for (const file of files) {
      const inRef = (() => {
        try {
          git('cat-file', '-e', `${restoreRef}:${file}`);
          return true;
        } catch {
          return false;
        }
      })();
      const snapshotCopy = join(dir, 'snapshot', file);
      if (inRef) {
        // --worktree only: `git checkout <ref> -- <file>` would also stage the
        // snapshot content, silently converting the user's unstaged work into
        // staged work. Restore must leave the index exactly as it was.
        git('restore', '--source', restoreRef, '--worktree', '--', file);
      } else if (existsSync(snapshotCopy)) {
        // Pre-existing untracked file saved by `workspace.mjs snapshot`.
        copyFileSync(snapshotCopy, file);
      } else {
        // The file did not exist before this edit — remove it.
        rmSync(file, { force: true });
      }
    }
    // The tree is back at the restore point, so the patch must apply cleanly.
    // A failure here means the patch is malformed — regenerate it, never force.
    try {
      git('apply', '--check', patchPath);
    } catch (err) {
      process.stderr.write(
        `stage-patch.mjs: ${patchPath} fails git apply --check — regenerate the patch\n${err?.message ?? err}\n`
      );
      process.exit(3);
    }
  }

  const stat = git('apply', '--stat', patchPath).trim().split('\n').pop();
  process.stdout.write(
    `staged ${patchPath}${noRestore ? ' (edits left in tree)' : ''} — ${stat}\n`
  );
} catch (err) {
  process.stderr.write(`stage-patch.mjs: ${err?.stderr ?? err?.message ?? err}\n`);
  process.exit(1);
}
