# Shared workflow — workspace, snapshot, validation, patches

Every command stages its work the same way: a scratch workspace, a restore
point, a green validation baseline, patches produced without dirtying the tree,
applied one at a time behind the project's own gate. This file is the **single
owner** of those mechanics — command references link here instead of restating
them, so a change to the procedure happens in exactly one place.

Two of the procedures are bundled scripts rather than prose, deliberately: the
workspace lifecycle and the patch capture each hide a failure mode that is easy
to trip when following steps by hand (details in each section). Use the scripts;
don't re-implement them inline. `<skill>` below is this skill's directory.

## Table of contents

- [The workspace — `.qoq/`](#the-workspace--qoq)
- [The safety snapshot](#the-safety-snapshot)
- [Validation commands & the green baseline](#validation-commands--the-green-baseline)
- [Staging a patch](#staging-a-patch)
- [Applying patches](#applying-patches)
- [Cleanup](#cleanup)

## The workspace — `.qoq/`

All scratch output — patches, JSON reports, the digest, snapshot copies — lives
under one git-ignored directory at the repo root:

```bash
node <skill>/scripts/workspace.mjs init
```

This creates `.qoq/reports/`, drops a self-ignoring `.qoq/.gitignore`, and adds
a labeled block to the root `.gitignore` (recording whether it created or
appended, so the revert is exact). The root entry matters beyond `git status`
noise: Prettier 3 honors the root `.gitignore` when it walks the tree, so an
un-ignored workspace full of generated files turns the Prettier gate red for
reasons unrelated to the code under review.

What lands where:

| Path                   | Contents                                                                       |
| ---------------------- | ------------------------------------------------------------------------------ |
| `.qoq/reports/`        | the `qoq --check --json` reports                                               |
| `.qoq/digest.txt`      | the `summarize.mjs` digest, when saved for subagents                           |
| `.qoq/*.patch`         | staged patches (per-area subdirs when fanning out)                             |
| `.qoq/snapshot/`       | copies of untracked files, saved by `snapshot`                                 |
| `.qoq/.workspace.json` | script state (gitignore disposition, snapshot ref, cached validation commands) |

## The safety snapshot

Before making any edit, record a restore point for the current tree:

```bash
node <skill>/scripts/workspace.mjs snapshot            # whole tree
node <skill>/scripts/workspace.mjs snapshot -- <paths> # scoped
```

It runs `git stash create` (a dangling commit of the tracked changes that
leaves the tree untouched) **and** copies untracked files into
`.qoq/snapshot/`. The copy is not optional: `git stash create` does not capture
untracked files, and a producer's freshly created file is the most common thing
`gate` and `fix` operate on — without the copy, a fix that regresses such a
file has no way back.

The printed ref (a SHA, or `HEAD` when the tree was clean) is the restore point
everything else uses:

- tracked file → `git checkout <ref> -- <file>`
- untracked file → copy back from `.qoq/snapshot/<file>`

`stage-patch.mjs` reads the ref from `.qoq/.workspace.json` and does both
automatically. Restore to the snapshot, never blindly to `HEAD` — on a dirty
tree, `HEAD` throws away the user's uncommitted work; on a clean tree the two
are identical, so the snapshot is always the safe choice.

Commands that require a clean tree (`review`, `refactor`) still take the
snapshot — it costs one command and makes the restore procedure identical
everywhere.

## Validation commands & the green baseline

Three commands are needed: how to **lint/format**, how to **test**, and how to
**build**. Discovery — especially the "ask if ambiguous" part — is not
something to repeat: check the cache before doing it, and write to the cache
once you have.

1. **Check the cache first.**

   ```bash
   node <skill>/scripts/workspace.mjs commands
   ```

   `null` means nothing is cached yet — discover as below. Anything else is
   the commands a previous phase (or a previous, aborted run reusing this same
   leftover `.qoq/`) already worked out — reuse them as-is and skip straight
   to running the baseline. This is what makes discovery a **once-per-workspace**
   fact rather than a once-per-phase one: `gate`/`fix`/`refactor`/`review` each
   read this cache in their own Phase 1, so re-invoking a command against a
   workspace that never got cleaned up (an aborted run) doesn't re-ask an
   ambiguity question the user already answered.

2. **On a cache miss, discover:**
   - **Lint/format** is the engine's territory ([engine.md](engine.md)): in
     QoQ mode it is `qoq --check` (or the project's `qoq:check` script) — one
     command covering every configured tool, exactly what CI runs. Without
     `qoq`, the engine's fallback applies.
   - **Test and build** — read `package.json` `scripts` and project docs
     (`README`, `CLAUDE.md`, `AGENTS.md`); prefer scripts the project already
     defines over commands you invent. Ask if ambiguous.

3. **Cache what you found** so nothing downstream re-derives it:

   ```bash
   node <skill>/scripts/workspace.mjs commands --set '{"lint":"…","test":"…","build":"…"}'
   ```

Run all three **before changing anything** and confirm they pass. This green
baseline locks in the exact commands to re-run after each patch — the
**validation step** — and is what makes a later failure attributable to a
patch. If something is already red on the untouched tree, surface it and ask
how to proceed: a red baseline can't validate anything. (`gate` and `fix`
record a red baseline instead of asking — their scope may legitimately start
red — but they still need to know it.)

## Staging a patch

The deliverable of an analysis is a real, `git apply`-able patch — not prose
describing a change. Edit the files in place (Edit tool) with the minimum fix,
then capture:

```bash
node <skill>/scripts/stage-patch.mjs <name> -- <changed paths…>
```

The script diffs the paths into `.qoq/<name>.patch`, restores the tree to the
snapshot ref, and verifies the patch with `git apply --check`. It exists
because the hand-rolled version of this recipe silently loses **new files**
(plain `git diff` ignores untracked files, so an extraction patch would carry
the edited call sites but drop the new shared module) and tends to restore to
the wrong point. Exit code `3` means the captured patch doesn't apply —
regenerate it, never force it.

Keep each patch **atomic**: a renamed export carries every touched reference,
an extracted clone carries both call sites _and_ the new shared unit, in the
one patch — an intermediate state that doesn't build defeats the
one-patch-at-a-time gate. Pass `--no-restore` only when the edit should stay in
the tree (e.g. `gate`'s auto-applied safe tier, captured for the record).

**Parallel staging:** never let two workers edit the same working tree at once
— their edits and restores trample each other. Give each worker an isolated
worktree or a disjoint file set; otherwise run sequentially.

## Applying patches

Apply approved patches **in sequence, lowest-risk first** — order matters
because later patches must apply on top of earlier ones, and a sequential
apply-validate loop is what makes any breakage attributable to exactly one
patch. The canonical dimension order:

1. `spellings.patch`
2. `dependencies.patch`
3. `complexity.patch`
4. `copy_paste.patch`
5. `conventions.patch`
6. `patterns.patch`
7. `typescript.patch`

(`bump packages` has its own order — see [bump.md](bump.md).)

For each patch:

```bash
git apply --check .qoq/<name>.patch   # confirm it still applies
git apply .qoq/<name>.patch
# then run the validation step (lint / test / build from the baseline)
```

- **A patch no longer applies** — an earlier patch moved its lines. Don't
  force it: regenerate just that one against the current tree (re-edit, then
  `stage-patch.mjs` with `--restore-to` pointing at the _current_ state — or
  simply re-edit and capture with `--no-restore` since it's about to be
  applied anyway), then continue.
- **Validation goes red** — restore the affected files from the snapshot ref
  to get back to the last green state. Interactive commands stop and report
  which patch broke what; `gate` and `fix` set the failed patch aside as an
  advisory and continue with the rest, so one bad fix never blocks the others.

## Cleanup

Cleanup is the reward for a green run, not a step you do regardless.

- **Fully successful run** — every approved patch applied and validated:

  ```bash
  node <skill>/scripts/workspace.mjs cleanup
  ```

  This removes `.qoq/` first and then reverts the `.gitignore` block (that
  order keeps the directory from flashing back into `git status`), deleting
  `.gitignore` entirely only if `init` created it and nothing else was added.
  The tree ends with exactly the applied improvements.

- **Aborted run** — a patch failed, validation went red and the user stopped,
  or approval was withheld: **leave `.qoq/` and the ignore block in place**.
  The staged patches are the record of what's left to do, and a later run can
  pick them up.
