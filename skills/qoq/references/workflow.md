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

- [Run modes — `tree` and `decisions`](#run-modes--tree-and-decisions)
- [The workspace — `.qoq/`](#the-workspace--qoq)
- [The safety snapshot](#the-safety-snapshot)
- [Validation commands & the green baseline](#validation-commands--the-green-baseline)
- [Staging a patch](#staging-a-patch)
- [Applying patches](#applying-patches)
- [Cleanup](#cleanup)

## Run modes — `tree` and `decisions`

Every analyzing command (`review`, `refactor`, `fix`, `gate`) runs against two
knobs. The defaults suit a human at a terminal; a caller that isn't one — a
producer skill, a plan-executing subagent, CI — overrides them explicitly.

| Knob        | Default | Override | What the override changes                                                       |
| ----------- | ------- | -------- | ------------------------------------------------------------------------------- |
| `tree`      | `clean` | `dirty`  | Skip the clean-tree precondition; lean on the safety snapshot instead            |
| `decisions` | `human` | `auto`   | Don't stop for sign-off: apply the safe tier, report the advisory tier, run on |

Pass them as flags after the scope — `refactor packages/cli/src --tree dirty
--decisions auto` — or in plain language from a calling skill ("run it
non-interactively over these files"). Unstated means the default; a caller that
only names one keeps the default for the other, since they're independent.

`gate` is not a fourth mode: it's `--tree dirty --decisions auto` pinned, which
is why it needs no flags. `fix`'s non-interactive shortcut is `--decisions auto`.

### `tree: dirty`

The clean-tree default exists so a human's in-progress edits never get tangled
in the tool's own restore path. But an agent that just wrote code **is** the
dirty tree — demanding a clean one would force it to commit work before anything
reviewed it, which defeats the point of reviewing at all.

The [safety snapshot](#the-safety-snapshot) is the safety net either way: it
captures tracked and untracked files both, so a restore is exact regardless of
what was dirty when the run started.

**Under `tree: dirty` the scope must be explicit.** Never fall back to
whole-project or to "everything dirty" — the caller's uncommitted work may sit
beside unrelated changes it didn't make and doesn't own, and analyzing those
silently widens the run past what anyone asked for. No scope given plus
`tree: dirty` is a caller error: say so and ask, rather than guessing generously.

### `decisions: auto`

No new judgment rule — the existing
[risk tiers](analysis.md#risk-tiers--safe-vs-advisory) already draw the line.
Auto mode applies the **safe tier** and reports the **advisory tier** as
findings instead of applying them. What counts as safe doesn't loosen because
nobody's watching; if anything, an unattended run is where the tier boundary
earns its keep.

Three questions the interactive flow would have asked, and their auto answers:

- **Plan sign-off** — skipped. Patches still stage, validate, and apply one at
  a time behind the project's own gate, so the mechanics and the audit trail
  are unchanged; only the pause disappears.
- **A missing external lens** ([delegation.md](delegation.md)) — don't offer to
  install it. Degrade to the remaining lenses and name the skipped one in the
  report, so the caller can see the analysis was partial.
- **Fan-out** — decide from the scope size instead of asking. A ticket-sized
  scope analyzes sequentially; only a genuinely broad one fans out.

**Patches stay inside the resolved scope.** A finding that would edit a file
outside it gets reported, never applied — under `auto` there's no human to
notice, and a parallel agent may own that file right now.

Return a structured result rather than prose: what applied, what's advisory,
and the validation outcome. A caller that couldn't be asked mid-run needs to
be able to act on the answer afterward.

## The workspace — `.qoq/`

All scratch output — patches, JSON reports, the digest, snapshot copies — lives
under one git-ignored directory at the repo root:

```bash
node <skill>/scripts/workspace.mjs init --run <run-id>
```

**Every invocation owns a private directory under `.qoq/runs/`,** named by the
`--run` id you pass. That isolation is what makes qoq safe to call from more
than one agent at a time: cleanup can only ever delete the run it was given, so
a wave of subagents each gating their own files can't tear down each other's
snapshots mid-run. The shared parts — the `.gitignore` entry, the cached
validation commands — survive until the last open run cleans up.

**Choosing a `--run` id.** Anything stable for the length of one command and
distinct from anything running beside it. A plan executor uses the ticket id
(`--run 2.3`); a human at a terminal can omit the flag entirely and get the
single `default` run, which behaves exactly as a lone workspace always has.
Concurrent callers that all take the default will corrupt each other — the id
is the whole mechanism, so pass it whenever anything else might be running.

Throughout these references, **`<ws>` means `.qoq/runs/<run-id>/`** — the
directory `init --run <run-id>` just created.

`init` also drops a self-ignoring `.qoq/.gitignore` and adds a labeled block to
the root `.gitignore` (recording whether it created or appended, so the revert
is exact). The root entry matters beyond `git status` noise: Prettier 3 honors
the root `.gitignore` when it walks the tree, so an un-ignored workspace full of
generated files turns the Prettier gate red for reasons unrelated to the code
under review.

What lands where:

| Path                    | Contents                                                          |
| ----------------------- | ----------------------------------------------------------------- |
| `<ws>/reports/`         | the `qoq --check --json` reports                                  |
| `<ws>/digest.txt`       | the `summarize.mjs` digest, when saved for subagents              |
| `<ws>/*.patch`          | staged patches (per-area subdirs when fanning out)                |
| `<ws>/snapshot/`        | copies of untracked files, saved by `snapshot`                    |
| `<ws>/.workspace.json`  | this run's state (snapshot ref, untracked copies)                 |
| `.qoq/.workspace.json`  | shared state (gitignore disposition, cached validation commands)  |

The split matters when reading state by hand: the snapshot ref is per-run, and
the validation commands are per-repo — discovery is a fact about the project,
so the first run in a wave pays for it and the rest read it.

## The safety snapshot

Before making any edit, record a restore point for the current tree:

```bash
node <skill>/scripts/workspace.mjs snapshot --run <run-id>            # whole tree
node <skill>/scripts/workspace.mjs snapshot --run <run-id> -- <paths> # scoped
```

The `--run` id must match the one `init` used, and flags come before the `--`
separator — everything after it is treated as a path.

It runs `git stash create` (a dangling commit of the tracked changes that
leaves the tree untouched) **and** copies untracked files into
`<ws>/snapshot/`. The copy is not optional: `git stash create` does not capture
untracked files, and a producer's freshly created file is the most common thing
`gate` and `fix` operate on — without the copy, a fix that regresses such a
file has no way back.

The printed ref (a SHA, or `HEAD` when the tree was clean) is the restore point
everything else uses:

- tracked file → `git checkout <ref> -- <file>`
- untracked file → copy back from `<ws>/snapshot/<file>`

`stage-patch.mjs --dir <ws>` reads the ref from `<ws>/.workspace.json` and does
both automatically. Restore to the snapshot, never blindly to `HEAD` — on a
dirty tree, `HEAD` throws away the user's uncommitted work; on a clean tree the
two are identical, so the snapshot is always the safe choice.

**Restore only the paths in your own scope.** `git stash create` snapshots the
whole tracked tree, so the ref legitimately contains other runs' in-flight edits
too. Restoring your scope's files from it is exact; restoring broadly would roll
back work that isn't yours and that nobody will notice is missing.

Commands that require a clean tree (`review`, `refactor`) still take the
snapshot — it costs one command and makes the restore procedure identical
everywhere.

**A broad `git checkout <ref> -- .`** (e.g. to peek at another ref's content
while diagnosing something mid-run) restores every tracked file in one shot —
including the root `.gitignore`, which `workspace.mjs init --run <run-id>` had just appended
its `.qoq/` block to. That checkout silently reverts the append while
`.qoq/.workspace.json` still records it as done, so the tree and the cached
state disagree about whether `.qoq/` is ignored — exactly the failure mode
this file's workspace section warns about (an un-ignored workspace turning
the Prettier gate red for reasons unrelated to the code under review). Scope
any mid-run checkout to the specific path you're inspecting instead of `.`;
if a broad one already happened, re-run `workspace.mjs init --run <run-id>`
(it's idempotent) before continuing.

## Validation commands & the green baseline

Three commands are needed: how to **lint/format**, how to **test**, and how to
**build**. Discovery — especially the "ask if ambiguous" part — is not
something to repeat: check the cache before doing it, and write to the cache
once you have.

1. **Check the cache first.**

   ```bash
   node <skill>/scripts/workspace.mjs commands
   ```

   `null` means nothing is cached yet — discover as below. Anything else was
   worked out by an earlier phase, another run open right now, or a previous
   run that never cleaned up — reuse it as-is and skip straight to running the
   baseline. The cache lives in the **shared** `.qoq/.workspace.json`, so it
   spans every run in a wave: the first ticket to discover pays, the rest read.

   **It lasts as long as `.qoq/` does, not longer.** The last open run's
   cleanup removes the whole workspace, cache included, so a series of
   one-at-a-time invocations does re-discover each time. If that matters —
   a plan executor running dozens of ticket gates — keep one long-lived run
   open (`init --run lead` at the start, `cleanup --run lead` at the end) and
   every invocation inside it inherits the cache.

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

Run all three **before changing anything**. **Test and build must come back
green** — they're binary, attribution-sensitive signals: a red test/build run
on the untouched tree leaves no clean state to attribute a later failure to,
so surface it and ask how to proceed (`gate` and `fix` record a red baseline
instead of asking — their scope may legitimately start red — but they still
need to know it).

**When other runs are in flight, redness may not be yours.** Test and build are
whole-project commands, so a concurrent agent's half-written file turns them red
in a run that never touched it. The baseline is what tells the two apart:
compare the failure against the baseline you recorded, and treat anything that
was _already_ failing before you edited, or that names a file outside your
scope, as not-yours — report it, don't chase it. Retrying can't fix another
agent's in-progress edit, and editing outside your scope to "help" is how two
runs start clobbering each other. This is the single biggest reason the baseline
is taken per run rather than assumed.

**Lint is different, and this is the one that matters most for `review` and
`refactor`.** The engine's `qoq --check` scans the whole configured `srcPath`
([engine.md](engine.md)), not the command's scope, so it reporting findings on
the untouched tree is the ordinary case, not a broken baseline — a real
codebase almost always has _some_ lint finding somewhere, very often inside
the very diff/scope the command was asked to look at. Don't stop-and-ask over
a red lint run the way you would over red test/build: the digest already
enumerates every finding by file, so a project-wide lint "failure" doesn't
stop you from attributing a later regression to whichever patch caused it.
What matters is **scope, not redness**: findings inside the command's scope
are exactly what Phase 2 turns into patches — that's the whole point of
running `review`/`refactor` — while findings outside it are pre-existing debt
the run isn't touching, worth a one-line mention in the Phase 3 plan for
honesty, never a reason to stop the command before Phase 2 even starts.

## Staging a patch

The deliverable of an analysis is a real, `git apply`-able patch — not prose
describing a change. Edit the files in place (Edit tool) with the minimum fix,
then capture:

```bash
node <skill>/scripts/stage-patch.mjs <name> --dir <ws> -- <changed paths…>
```

`--dir` points the script at this run's workspace — that's where it finds the
snapshot ref and the untracked copies it restores from, so omitting it on a
concurrent run reads another run's restore point.

The script diffs the paths into `<ws>/<name>.patch`, restores the tree to the
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

**Parallel staging:** never let two workers edit the same _file_ at once — their
edits and restores trample each other, and the loser's work vanishes with no
error. Disjoint file sets are safe and are the normal case for a plan executor's
wave: separate `--run` ids keep the workspaces apart, and non-overlapping paths
keep the edits apart. Overlapping paths need an isolated worktree or a
sequential run; there is no merge step here.

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
git apply --check <ws>/<name>.patch   # confirm it still applies
git apply <ws>/<name>.patch
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
  node <skill>/scripts/workspace.mjs cleanup --run <run-id>
  ```

  This always removes **your** run directory. It goes on to remove `.qoq/` and
  revert the `.gitignore` block only when no other run is still open — the
  script checks and tells you which ones it found. That check is the point: a
  cleanup that tore down the shared workspace while a sibling run was mid-fix
  would take that run's snapshot with it, and a snapshot is the only way back
  for a freshly created file whose fix regressed.

  When it is the last one out, it removes `.qoq/` first and then reverts the
  `.gitignore` block (that order keeps the directory from flashing back into
  `git status`), deleting `.gitignore` entirely only if `init` created it and
  nothing else was added. The tree ends with exactly the applied improvements.

- **Aborted run** — a patch failed, validation went red and the user stopped,
  or approval was withheld: **leave `<ws>` and the ignore block in place**.
  The staged patches are the record of what's left to do, and a later run can
  pick them up by passing the same `--run` id.
