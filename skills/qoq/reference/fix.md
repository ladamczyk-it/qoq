# fix

A **fix-focused** command: it does not ask whether the code is good enough — that
is [gate.md](gate.md) — and it does not write a review narrative — that is
[review.md](review.md). It concentrates on the one job of _turning findings into
landed fixes_, and it delivers every one of those fixes as a **reviewable git
patch** applied one at a time behind the project's own lint/test/build gate.

It is built entirely out of two existing pieces, so there is no third standard to
keep in sync:

- It **utilizes `gate`** for the front half — the `git stash create` safety
  snapshot, the baseline validation run, and the same seven-dimension analysis
  (verbatim, via the engine). The one thing it changes is **scope**: where `gate`
  scopes to the producer's just-changed files, `fix` runs `qoq --check` over the
  **full project** (or a scope you name) and works the findings it surfaces — it
  **does not scan for modified files**. `fix` is a _profile_ over the gate engine,
  exactly as `gate` is a profile over `review`.
- It **leverages the `review` / `refactor` best practices** for the back half —
  the edit→diff→restore→check patch recipe, the plan→approve→execute split, the
  apply-one-at-a-time-and-revalidate loop, and the readability/cleanup pass.

The one thing `fix` adds is the bridge between them. `gate` _auto-applies_ the
safe tier with `Edit` and merely _reports_ the judgment-call tier (dead-code
deletion, clone extraction, pattern changes) as advisories it refuses to make
autonomously. `fix` escalates: it stages **both** tiers as patches, so the
advisories gate would have left on the floor become concrete, individually
approvable, individually revertible changes the user can accept, edit, or drop.

| Aspect        | `gate`                                       | `fix`                                                                             |
| ------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| Question      | "is this good enough?" → PASS / FAIL         | "make this good" → patches that land the fixes                                    |
| Scope         | the producer's just-changed files            | **the full project** (or a scope you name) — `qoq --check`, never the dirty files |
| Working tree  | expected dirty (the changes _are_ the scope) | clean or dirty — tolerated via the snapshot, but the scope is the project         |
| Safe tier     | auto-applied with `Edit`                     | **staged as a patch** (approved by default, still revalidated)                    |
| Advisory tier | reported, never applied                      | **staged as a patch too**, surfaced for explicit approval                         |
| Delivery      | direct edits + a verdict                     | **every change is a `git apply`-able patch** applied behind the gate              |
| Approval      | none (caller pre-authorized)                 | present the plan, get sign-off, then execute (review-style)                       |

Use `fix` when you want findings _fixed_ rather than reported — across the whole
project by default, or over a scope you name — and you want the fixes as a clean,
reviewable patch series rather than a silent auto-apply or a wall of prose.

---

## Phase 1 — Resolve scope & baseline (reuse `gate` Phase 1)

Setup already located the engine. Follow [gate.md](gate.md)'s **Phase 1** for the
snapshot and baseline, with one deliberate change: **`fix` does not scan for
modified files.** Its scope is the whole codebase by default, not the dirty tree.

1. **Determine the scope.** With no argument, the scope is the **full project** —
   run `qoq --check` over the entire codebase (the engine's default) and let the
   findings it surfaces define the work. When the user names a scope instead — a
   path, glob, package, or directory ([refactor.md](refactor.md)-style) — resolve it
   with `git ls-files` and work exactly that. Either way the scope comes from the
   argument (or its absence), **never** from `git status` / `git diff`. If a named
   scope resolves to nothing, say so and stop.

2. **Take the safety snapshot.** `git stash create "qoq-fix snapshot"`; record the
   SHA. This is the restore point if a patch regresses validation
   (`git checkout <sha> -- <files>`), the same net `gate` relies on instead of the
   clean-tree baseline — it lets `fix` tolerate a dirty tree without making the dirty
   files the scope. (If it prints nothing the tree was clean against HEAD — fall back
   to `HEAD` for tracked files, and keep untracked files in mind.)

3. **Establish the baseline gate result.** Run the engine's lint gate
   (`qoq --check` in QoQ mode) plus the project's test/build over the scope once, so
   you know the starting state and lock in the exact commands you'll re-run after
   each patch — the _validation step_. Use `.qoq/` as the workspace
   (`mkdir -p .qoq`), add the labeled `.qoq/` block to `.gitignore`, and revert it in
   Phase 5, exactly as the other commands do.

---

## Phase 2 — Stage every fix as a patch (gate's analysis, `review`'s recipe)

Prime the reports once and read the digest via the engine ([engine.md](engine.md)),
then filter the findings down to the Phase 1 scope. Run the **seven dimensions from
[review.md](review.md)'s Phase 2** over that scope (skip TypeScript idioms for plain
JS) — the same analysis `gate` runs.

The difference from `gate` is in what you do with a finding. `gate` applies the safe
tier and reports the rest; **`fix` stages _both_ tiers as patches and applies
nothing yet**, using the canonical edit→diff→restore→check recipe so the working
tree stays untouched until Phase 4:

```bash
# 1. Edit the file(s) in place with the minimum fix (Edit tool).
# 2. Capture as a patch:
git diff -- <changed paths> > .qoq/<name>.patch
# 3. Restore the tree so the next dimension starts clean:
git checkout <snapshot-sha> -- <changed paths>   # restore to the Phase 1 snapshot, not HEAD
# 4. Verify it applies:
git apply --check .qoq/<name>.patch
```

Restore to the **snapshot SHA from Phase 1**, not `git restore`/`HEAD` — the
snapshot captures whatever uncommitted work the tree had, so restoring to it never
throws that away (on a clean tree the snapshot equals HEAD). Name patches with the
standard dimension names so Phase 4 can order them: `spellings`, `dependencies`,
`complexity`, `copy_paste`, `conventions`, `patterns`, `typescript`.

Tag each staged patch with its tier, since that drives approval in Phase 3:

- **Safe tier** — formatting and auto-fixable lint, naming/spelling, local
  conventions (arrow-over-`function`, named-over-default with in-scope import
  sites), clear complexity wins, honest-type fixes replacing an introduced `any`.
  These are approved by default.
- **Advisory tier** — the judgment calls `gate` refuses to auto-make: dead-code /
  unused-dependency deletion (Knip), de-duplication / clone extraction (JSCPD), and
  design-pattern changes. `fix` _stages_ these as patches so they can land, but they
  default to **needs-approval** — a Knip "unused" export may be reached by a test or
  a dynamic import, a clone may answer to two different reasons to change.

Respect the project's config throughout (`qoq.config.js` ignores and thresholds) —
a "fix" that violates a configured ignore or extracts a clone under threshold is not
a finding. For broad scopes you may fan out to the `qoq-analyzer` worker over
disjoint files exactly as [refactor.md](refactor.md)'s Phase 2 describes; each worker
still only _stages_ patches, and must restore to the snapshot SHA rather than HEAD.

---

## Phase 3 — Present the plan & get approval (reuse `review` Phase 3)

Summarize the staged patches grouped by dimension, each with a one-line rationale
and a sense of size — but **split the summary by tier** so the user sees at a glance
which patches are mechanical and which are judgment calls:

- **Safe tier** — listed as the default-on set; quality-over-quantity still applies,
  so recommend _dropping_ any low-value churn.
- **Advisory tier** — each called out with _why_ it needs a human: what the Knip
  finding might still be used by, why the two clones might honestly differ, why the
  pattern may add more complexity than it removes.

Then ask whether to **edit the plan** (drop or adjust patches — typically the user
keeps the safe tier and cherry-picks advisories) or whether you may **execute it**,
and wait. Don't apply anything yet.

**Non-interactive shortcut.** If the caller (a skill, or the user up front) said to
run autonomously, skip the pause: apply the safe tier, leave the advisory tier
staged in `.qoq/` as patches, and report them — the same posture `gate` takes, except
the advisories are left as ready-to-apply patch files rather than prose.

---

## Phase 4 — Execution (reuse `review` Phase 4)

Apply the approved patches **in sequence**, lowest-risk first, exactly as
[review.md](review.md)'s Phase 4 describes:

1. `spellings.patch`
2. `dependencies.patch`
3. `complexity.patch`
4. `copy_paste.patch`
5. `conventions.patch`
6. `patterns.patch`
7. `typescript.patch`

For each: `git apply --check` → `git apply` → run the validation step. After each
apply, revalidate before moving on so any breakage points at exactly one patch.

- **A patch no longer applies** (an earlier patch moved its lines): don't force it —
  regenerate just that one against the current tree with the Phase 2 recipe
  (restoring to the snapshot, not HEAD), then apply the fresh one.
- **Validation goes red after a patch:** stop, report which patch broke what, and
  restore the affected files from the snapshot (`git checkout <snapshot-sha> --
<files>`) to get back to the last green state. One bad fix never blocks the rest —
  set it aside as a left-behind advisory and continue with the others, the same way
  `gate` does.

---

## Phase 5 — Readability, cleanup & optional verdict (reuse `review` Phase 5)

Once the approved patches are in and green, format the changed files with the
project's formatter (`qoq --fix` / `qoq:fix` in QoQ mode, else Prettier), run the
validation step one final time, and summarize what landed — grouped by dimension,
noting which advisories were applied and which were left staged.

Then clean up, in order: `rm -rf .qoq/`, then revert the `.gitignore` block added in
Phase 1 (or `git restore .gitignore`). The tree ends with the snapshot's original
contents plus the fixes that landed.

**Optional gate-style verdict.** Because `fix` is built on the gate engine, it can
close with the same structured verdict so a calling skill can branch on it — emit it
only when invoked programmatically or asked to:

```
QoQ FIX — PASS            (or: QoQ FIX — FAIL)
scope:      <n files>
applied:
  - <dimension>: <what landed>          (omit empty dimensions)
left staged (advisory, not applied):
  - <dimension>: <patch path> — <why it needs a human>   (omit when none)
validation: qoq --check ✓ · tests ✓ · build ✓   (or the failing command + why)
```

`PASS` = the approved patches are in and validation is green; `FAIL` = validation
couldn't be made green or a hard standard couldn't be fixed. When a verdict isn't
requested, a plain prose summary of what landed is enough.

---

## Quick reference

- **Relationship:** front half = [gate.md](gate.md) (snapshot, baseline,
  seven-dimension analysis — but full-project scope, not the dirty tree); back half =
  [review.md](review.md) (patch recipe, plan→approve→execute, validate-after-each,
  readability). `fix` only adds: stage **both** tiers as patches and apply the
  approved ones behind the gate.
- **Scope:** the **full project** by default (`qoq --check` over the whole
  codebase), or a `refactor`-style chosen scope when named. `fix` never scans for
  modified files.
- **Safety net:** the `git stash create` snapshot — restore to that SHA, never to
  HEAD, because the snapshot captures any uncommitted work the tree had.
- **Delivery:** every change is a reviewable, individually-revertible `git apply`-able
  patch, applied one at a time behind the project's lint/test/build gate.
- **vs. `gate`:** `gate` auto-applies the safe tier and reports advisories for a
  PASS/FAIL verdict; `fix` stages both tiers as patches and lands the approved set.
