# fix

A **fix-focused** command: it does not ask whether the code is good enough —
that is [gate.md](gate.md) — and it does not review a branch — that is
[review.md](review.md). Its one job is _turning findings into landed fixes_,
delivered as **reviewable git patches** applied one at a time behind the
project's own lint/test/build gate.

The analysis is the shared seven dimensions ([analysis.md](analysis.md)); the
snapshot/staging/apply mechanics are the shared workflow
([workflow.md](workflow.md)). What is fix-specific:

- **Scope** — the **full project** by default (`qoq --check` over the whole
  codebase, the engine's native mode), or a scope the user names. `fix` never
  scans for modified files — a dirty tree is tolerated (the snapshot protects
  it) but is not the scope. That's the difference from `gate`.
- **Both tiers become patches.** `gate` auto-applies the safe tier and merely
  _reports_ the judgment calls (dead-code deletion, clone extraction, pattern
  changes) as advisories. `fix` escalates: it stages **every** fix — both tiers
  — as concrete, individually approvable, individually revertible patches, so
  the advisories `gate` leaves on the floor can actually land.

Reach for `fix` when the goal is to _land_ the findings as a clean patch
series, not to get a PASS/FAIL verdict or a review narrative.

---

## Phase 1 — Resolve scope & baseline

Setup already located the engine. A dirty tree is tolerated — the snapshot is
the safety net, not a clean-tree requirement.

1. **Determine the scope.** With no argument, the scope is the **full
   project** — `qoq --check` over the entire codebase, letting the findings it
   surfaces define the work. When the user names a scope — a path, glob,
   package, or directory — resolve it to a file list with `git ls-files`,
   exactly as [refactor.md](refactor.md)'s Phase 1 does. Either way the scope
   comes from the argument (or its absence), **never** from
   `git status`/`git diff`. If a named scope resolves to nothing, say so and
   stop.

2. **Initialize the workspace and take the snapshot** per
   [workflow.md](workflow.md) (`workspace.mjs init` + `snapshot`). The
   snapshot ref is the restore point for every staged patch — it captures any
   uncommitted work the tree had, so restoring to it never throws that away.

3. **Establish the baseline** — discover the validation commands and run them
   once, per [workflow.md](workflow.md#validation-commands--the-green-baseline).
   Like `gate`, record a red baseline rather than stopping (the findings being
   red is often why `fix` was called) — but know exactly what was red before
   the first patch lands.

---

## Phase 2 — Stage every fix as a patch

Prime the reports once and read the digest via the engine
([engine.md](engine.md)), filter the findings to the Phase 1 scope, and run
the seven dimensions from [analysis.md](analysis.md) (skip TypeScript idioms
for plain JS).

Stage each dimension's fix with `stage-patch.mjs`
([workflow.md](workflow.md#staging-a-patch)) — the script restores to the
snapshot ref automatically, so the working tree stays untouched until Phase 4.
Use the standard patch names so Phase 4 can order them.

Tag each staged patch with its tier, since that drives approval in Phase 3:

- **Safe tier** — formatting and auto-fixable lint, naming/spelling, local
  conventions (arrow-over-`function`, named-over-default with in-scope import
  sites), clear complexity wins, honest-type fixes replacing an introduced
  `any`. Approved by default.
- **Advisory tier** — the judgment calls `gate` refuses to auto-make:
  dead-code / unused-dependency deletion (Knip), de-duplication / clone
  extraction (JSCPD), and design-pattern changes. Staged as patches so they
  _can_ land, but they default to **needs-approval** — a Knip "unused" export
  may be reached by a test or a dynamic import, a clone may answer to two
  different reasons to change.

Respect the project's config throughout (`qoq.config.js` ignores and
thresholds). For broad scopes, fan out to the `qoq-analyzer` worker over
disjoint slices exactly as [refactor.md](refactor.md)'s Phase 2 describes —
workers only _stage_ patches, and restore to the snapshot ref, never HEAD.

---

## Phase 3 — Present the plan & get approval

Summarize the staged patches grouped by dimension, each with a one-line
rationale and a sense of size — **split by tier** so the user sees at a glance
which patches are mechanical and which are judgment calls:

- **Safe tier** — the default-on set; quality-over-quantity still applies, so
  recommend _dropping_ any low-value churn.
- **Advisory tier** — each called out with _why_ it needs a human: what the
  Knip finding might still be used by, why two clones might honestly differ,
  why the pattern may add more complexity than it removes.

Ask whether to **edit the plan** (typically the user keeps the safe tier and
cherry-picks advisories) or **execute it**, and wait.

**Non-interactive shortcut.** If the caller (a skill, or the user up front)
said to run autonomously: apply the safe tier, leave the advisory tier staged
in `.qoq/` as patches, and report them — the same posture `gate` takes, except
the advisories are ready-to-apply patch files rather than prose.

---

## Phase 4 — Execution

Apply the approved patches per [workflow.md](workflow.md#applying-patches):
canonical dimension order, `git apply --check` → `git apply` → validation step
after each. On a patch that no longer applies, regenerate just that one; if
validation goes red, restore the affected files from the snapshot, set that
patch aside as a left-behind advisory, and continue with the others — one bad
fix never blocks the rest (the `gate` posture, since `fix` may run
non-interactively).

---

## Phase 5 — Readability, cleanup & optional verdict

Format the changed files (`qoq --fix` / `qoq:fix` in QoQ mode, else Prettier),
run the validation step one final time, and summarize what landed — grouped by
dimension, noting which advisories were applied and which were left staged.
Then clean up per [workflow.md](workflow.md#cleanup) — on a fully successful
run only; an abort leaves `.qoq/` as the record.

**Optional gate-style verdict** — emit only when invoked programmatically or
asked to, so a calling skill can branch on it:

```
QoQ FIX — PASS            (or: QoQ FIX — FAIL)
scope:      <n files>
applied:
  - <dimension>: <what landed>          (omit empty dimensions)
left staged (advisory, not applied):
  - <dimension>: <patch path> — <why it needs a human>   (omit when none)
validation: qoq --check ✓ · tests ✓ · build ✓   (or the failing command + why)
```

`PASS` = the approved patches are in and validation is green; `FAIL` =
validation couldn't be made green or a hard standard couldn't be fixed. When a
verdict isn't requested, a plain prose summary of what landed is enough.
