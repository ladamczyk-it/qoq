# gate

A **non-interactive quality gate** other skills (and you, mid-task) call before
declaring work done. A producer — a test generator, a feature scaffold, a
migration writer, a codegen step — finishes, then runs `gate` over the files it
just wrote to bring them up to the QoQ standards and return a verdict the
caller branches on.

It runs the **same seven-dimension analysis** as every other command
([analysis.md](analysis.md)) — no separate standard to drift. What
distinguishes it (the full command comparison lives in
[SKILL.md](../SKILL.md#commands)):

- **Scope** — the producer's just-changed files; the tree is _expected_ dirty.
- **Autonomy** — runs to completion with no interactive approval (the caller
  already authorized it).
- **Risk split** — safe fixes are auto-applied behind the validation gate;
  judgment calls become advisories, never autonomous changes.
- **Output** — a structured `PASS`/`FAIL` verdict.

---

## Phase 1 — Resolve scope & baseline

Setup already located the engine. **Do not demand a clean working tree** — the
producer's uncommitted work _is_ the scope.

1. **Determine the scope.**
   - **Explicit paths passed by the caller** (preferred) — gate exactly those
     files, ignoring unrelated dirty files in the tree.
   - **No paths** — infer from the working tree (staged, unstaged, and
     untracked source files):

     ```bash
     git status --porcelain -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs'
     git diff -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs'
     ```

   If the resolved scope is empty, return `PASS` immediately with "nothing to
   gate".

2. **Initialize the workspace and take the safety snapshot** per
   [workflow.md](workflow.md):

   ```bash
   node <skill>/scripts/workspace.mjs init
   node <skill>/scripts/workspace.mjs snapshot -- <scope paths>
   ```

   The snapshot captures the producer's work _before_ any gate fix — tracked
   changes via `git stash create` **and** copies of untracked files (a
   producer's brand-new files aren't in the stash commit; the copy is what
   makes them restorable). If a fix regresses validation, restore the affected
   files from the printed ref / `.qoq/snapshot/`.

3. **Establish the baseline.** Discover the validation commands and run them
   once over the scope, per
   [workflow.md](workflow.md#validation-commands--the-green-baseline). A
   producer's fresh code may already be red — record that rather than asking;
   the verdict needs to know the starting state.

---

## Phase 2 — Analyze and auto-fix

Prime the reports once and read the digest via the engine
([engine.md](engine.md)), filter the findings to the scope, and run the seven
dimensions from [analysis.md](analysis.md) (skip TypeScript idioms for plain
JS). The difference from the interactive commands: **apply as you go** instead
of staging for approval — split by risk:

**Safe tier — auto-apply.** Mechanical or high-confidence, rarely changes
behavior. Apply directly (Edit / `qoq --fix`), one dimension at a time, running
the scoped validation gate after each so any regression is attributable:

- Formatting (`qoq --fix` / Prettier) and the auto-fixable ESLint/Stylelint
  rules.
- Naming-convention and spelling fixes.
- Code conventions (arrow-over-`function`, named-over-default exports) where
  the rewrite is local and the import sites are in scope.
- Clear complexity wins — an early return, a small well-named extraction —
  when it unambiguously reads better.
- Honest-type fixes that replace an introduced `any` with the real type.

If a dimension's fixes regress validation, **restore just those files from the
snapshot**, record the dimension as a failed-to-apply advisory, and continue
with the rest. One bad fix never blocks the others.

**Advisory tier — report, don't apply.** These need human judgment:

- **Dead-code / unused-dependency deletion (Knip)** — deleting something a
  test or a dynamic import actually uses is the classic false positive.
- **De-duplication / clone extraction (JSCPD)** — only worth it when the
  abstraction is honest.
- **Design-pattern changes** — never refactor to a pattern autonomously.

(If the caller explicitly passed an "aggressive" / "apply everything"
preference, the advisory tier may be applied too — still one dimension at a
time behind the gate, still skipping anything that regresses validation.)

Respect the project's config throughout (`qoq.config.js` ignores and
thresholds) — a "fix" that violates a configured ignore or a JSCPD clone under
threshold is not a finding.

---

## Phase 3 — Final validation

With the safe fixes applied, run the **full** validation gate over the scope
one last time — the engine's `qoq --check` (or `qoq:check`) plus the project's
`test`/`build` when any logic changed. This is the signal the verdict reports.

- All green → `PASS`.
- Cannot be made green (a fix can't be both applied and pass, or the
  producer's code was red in a way the safe tier can't resolve) → `FAIL`.

---

## Phase 4 — Clean up and return the verdict

1. **Clean up:** `node <skill>/scripts/workspace.mjs cleanup`. The only thing
   left in the working tree is the producer's code plus the safe fixes the
   gate applied.

2. **Return a structured verdict** — this is what the calling skill consumes,
   so keep the shape stable:

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

   - **`PASS`** = scope meets the standards and validation is green.
     Advisories may remain — they are judgment calls, not failures.
   - **`FAIL`** = validation couldn't be made green, or a hard standard is
     violated and couldn't be auto-fixed. `blockers` names exactly what to fix.

The producer reacts per the contract in
[Consuming `/qoq` from another skill](../SKILL.md#consuming-qoq-from-another-skill):
declare done only on `PASS` (passing along advisories); on `FAIL`, address the
blockers and re-gate.
