# gate

A **non-interactive quality gate** other skills (and you, mid-task) call before
declaring work done. A producer — a test generator, a feature scaffold, a
migration writer, a codegen step — finishes, then runs `gate` over the files it
just wrote to bring them up to the QoQ standards and return a verdict the caller
branches on.

It runs the **exact same analysis as [review.md](review.md)** — the seven
dimensions and the engine, verbatim — so there is no separate standard to drift.
`gate` is a _profile_ over that engine, not new analysis. It changes only how the
analysis is driven:

| Aspect       | `review`                | `refactor`              | `gate`                                                            |
| ------------ | ----------------------- | ----------------------- | ----------------------------------------------------------------- |
| Scope        | branch vs. base diff    | a scope you choose      | **the producer's just-changed files** (working-tree diff default) |
| Working tree | must be clean           | must be clean           | **expected dirty** — the changes _are_ the scope                  |
| Autonomy     | stop at decision points | stop at decision points | **run to completion, no interactive approval**                    |
| Risky fixes  | staged for approval     | staged for approval     | **safe fixes auto-applied; judgment calls become advisories**     |
| Output       | plan + summary          | plan + summary          | **a structured `PASS` / `FAIL` verdict** the caller acts on       |

Because the caller already authorized the gate, it doesn't pause to ask — but it
also doesn't autonomously make the high-risk changes (deleting "dead" code,
extracting a shared abstraction) that QoQ normally stages for human sign-off.
Those it reports, so the producer or the user can decide.

---

## Phase 1 — Resolve scope (no clean-tree gate)

Setup already located the engine. Unlike the other commands, **do not demand a
clean working tree** — a dirty tree is the whole point; the producer's uncommitted
work is the scope.

1. **Determine the scope.**
   - **Explicit paths passed by the caller** (preferred) — gate exactly those
     files, ignoring unrelated dirty files in the tree. This is how a producer
     scopes the gate to just what it wrote.
   - **No paths** — infer the scope from the working tree: the changed and new
     source files reported by

     ```bash
     git status --porcelain -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs'
     git diff -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs'
     ```

     (staged, unstaged, and untracked). Bound everything downstream to this set.

   If the resolved scope is empty, return `PASS` immediately with "nothing to
   gate" — there is no produced code to check.

2. **Take a safety snapshot.** The normal edit→diff→restore patch dance needs a
   clean baseline, which you don't have. Instead snapshot the current dirty tree
   without disturbing it:

   ```bash
   git stash create "qoq-gate snapshot"   # prints a commit SHA, leaves the tree untouched
   ```

   Record that SHA. It captures the producer's work _before_ any gate fix, so if a
   fix regresses validation you can restore the affected files exactly:
   `git checkout <snapshot-sha> -- <files>`. (If `git stash create` prints nothing
   the tree was already clean against HEAD — fall back to `HEAD` as the restore
   point for tracked files; keep untracked produced files in mind separately.)

3. **Establish the baseline gate result.** Run the engine's lint gate and the
   project's test/build over the scope once, to know the starting state (a
   producer's fresh code may already be red). Discover the validation commands as
   [review.md](review.md)'s Phase 1 describes (in QoQ mode the lint gate is
   `qoq --check`). Use `.qoq/` as the workspace for reports and the digest, exactly
   as the other commands do — `mkdir -p .qoq`, add the labeled `.qoq/` block to
   `.gitignore`, and revert it in Phase 4.

---

## Phase 2 — Analyze and auto-fix

Prime the reports once and read the digest via the engine
([engine.md](engine.md)), then filter the findings to the scope from Phase 1.
Run the seven dimensions from [review.md](review.md)'s Phase 2 over the scope (skip
TypeScript idioms for plain JS). The difference from `review` is that you **apply**
as you go instead of staging for approval — split by risk:

**Safe tier — auto-apply.** These are mechanical or high-confidence and rarely
change behavior. Apply them directly (Edit / `qoq --fix`), one dimension at a time,
running the scoped validation gate after each so any regression is attributable:

- Formatting (`qoq --fix` / Prettier) and the auto-fixable ESLint/Stylelint rules.
- Naming-convention and spelling fixes.
- Code conventions (arrow-over-`function`, named-over-default exports) where the
  rewrite is local and the import sites are in scope.
- Clear complexity wins — an early return, a small well-named extraction — when it
  unambiguously reads better.
- Honest-type fixes that replace an introduced `any` with the real type.

After each dimension's fixes, run the validation gate. **If it regresses, restore
just those files from the snapshot** (`git checkout <snapshot-sha> -- <files>`),
record the dimension as a failed-to-apply advisory, and continue with the rest. One
bad fix never blocks the others.

**Advisory tier — report, don't apply.** These need human judgment, so the gate
surfaces them instead of making them autonomously:

- **Dead-code / unused-dependency deletion (Knip)** — deleting something a test or
  a dynamic import actually uses is the classic false positive. Report it; don't
  delete.
- **De-duplication / clone extraction (JSCPD)** — only worth it when the
  abstraction is honest. Report the clone and the suggested extraction; let the
  caller decide.
- **Design-pattern changes** — report the smell and the pattern; never refactor to
  a pattern autonomously.

(If the caller explicitly passed an "aggressive" / "apply everything" preference,
you may apply the advisory tier too — but still one dimension at a time behind the
gate, and still skip anything that regresses validation.)

Respect the project's config throughout (`qoq.config.js` ignores and thresholds) —
a "fix" that violates a configured ignore or a JSCPD clone under threshold is not a
finding.

---

## Phase 3 — Final validation

With the safe fixes applied, run the **full** validation gate over the scope one
last time — the engine's `qoq --check` (or `qoq:check`) plus the project's
`test`/`build` when any logic changed. This is the signal the verdict reports.

- All green → the scope meets the standards → verdict is `PASS`.
- Cannot be made green (a fix can't be both applied and pass, or the producer's
  code was red in a way the safe tier can't resolve) → verdict is `FAIL`.

---

## Phase 4 — Clean up and return the verdict

1. **Clean up the workspace.** `rm -rf .qoq/`, then revert the `.gitignore` block
   you added in Phase 1 (or `git restore .gitignore`). The only thing left in the
   working tree is the producer's code plus the safe fixes the gate applied.

2. **Return a structured verdict** — this is what the calling skill consumes, so
   keep the shape stable:

   ```
   QoQ GATE — PASS            (or: QoQ GATE — FAIL)
   scope:      <n files>  (<list or summary>)
   applied:
     - formatting: <what changed>
     - naming: <what changed>
     - …                       (omit dimensions with nothing to apply)
   advisories (not auto-applied):
     - dead code: knip flags <X> — confirm before deleting (may be used by <…>)
     - duplication: clone between <A> and <B> — extract only if the abstraction is honest
     - …                       (omit when none)
   validation: qoq --check ✓ · tests ✓ · build ✓   (or the failing command + why)
   blockers (FAIL only):
     - <what is red and what the producer must address>
   ```

   - **`PASS`** = scope meets the standards and validation is green. Advisories may
     remain — they are judgment calls, not failures.
   - **`FAIL`** = validation couldn't be made green, or a hard standard is violated
     and couldn't be auto-fixed. The `blockers` section names exactly what to fix.

The producer reacts per the contract in the skill's
[Consuming `/qoq` from another skill](../SKILL.md#consuming-qoq-from-another-skill)
section: declare done only on `PASS` (passing along advisories); on `FAIL`, address
the blockers and re-gate.

---

## Quick reference

- **Engine:** same as [review.md](review.md) — seven dimensions, the qoq digest,
  the validation gate. No separate standard.
- **Scope:** the caller's explicit file list, else the working-tree diff. Bounded,
  never the whole project.
- **Safety net:** a `git stash create` snapshot (the tree is intentionally dirty),
  not the clean-tree + staged-patch model.
- **Autonomy:** runs to completion; auto-applies the safe tier behind the gate,
  reports the judgment tier as advisories, never pauses for approval.
- **Output:** a `PASS` / `FAIL` verdict with applied fixes, advisories, and the
  validation result — the contract other skills branch on.
