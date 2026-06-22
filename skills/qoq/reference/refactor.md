# refactor

This command applies the QoQ code-quality analysis to a **scope you choose** — one
or more paths/globs, a monorepo package, a directory, or, by default, the whole
project — rather than to the changes a branch introduced. It uses no base branch and
no diff.

It does **not** redefine the analysis. Everything about _how_ each quality dimension
is detected and turned into a patch — the seven dimensions, the engine handoff for the
tool-backed findings, the edit→diff→restore→check patch recipe, the design-pattern
catalog, and the apply/validate/regenerate execution mechanics — lives in
[review.md](review.md), the single source of truth. This command is a thin layer on
top that changes two things:

1. **Where the work comes from** — a user-chosen _scope_ instead of a branch-vs-base
   diff.
2. **How the work is carried out at size** — an _orchestrator_ that fans the analysis
   across subagents by code area.

Reusing the engine this way is deliberate: when `review`'s standards evolve (a new
dimension, a sharper patch recipe), this command inherits the change automatically —
nothing here to keep in sync.

## Step 0 — Load the shared engine

Before doing anything, **read [review.md](review.md) in full** — it is the canonical
definition of the analysis this command performs. Hold it as the base procedure.
Everything below is a **diff against it** — apply its instructions except where this
file overrides them. The overrides, in one table:

| In `review`                                                   | In `refactor`                                                                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Scope = `git diff` of the branch vs. its base branch          | Scope = a **user-chosen** set of files (default: the whole project). See **Phase 1** below.                            |
| "Ask for the base branch" / `git merge-base` / diff the range | **Skip entirely.** Resolve the scope instead.                                                                          |
| "Only review the changed lines from Phase 1"                  | Analyse the **whole resolved scope**; report only findings inside it.                                                  |
| Optional fan-out **by dimension**                             | Orchestrated fan-out **by code area**. See **Phase 2** below.                                                          |
| Patches live directly in `.qoq/`                              | Per-area patches live in `.qoq/<area>/` under the same shared workspace; the orchestrator regroups them for execution. |

Everything not in this table — the clean-tree check (done in Setup), the engine tool
discovery, validation-command discovery and green baseline, the seven dimensions and
their tooling, the patch recipe, the design-patterns reference, the apply/validate
loop, and the readability pass — you perform **exactly as `review` describes**,
over the shared `.qoq/` workspace.

---

## Phase 1 — Scoping (deltas)

Follow `review`'s Phase 1, with these changes:

- **Keep:** the engine tool discovery and the validation-command discovery + green
  baseline. They are unchanged. (The clean-tree check already happened in Setup.)
- **Replace "ask for the base branch" + the `merge-base`/diff steps with scope
  resolution.** Ask the user what to refactor, unless they already said. Accept
  whichever form is natural and resolve it to a concrete file list:
  - **Paths / globs** — e.g. `packages/cli/src`, `src/**/*.ts`, a few named files.
  - **A monorepo package** — e.g. "the `knip` package" → `packages/knip/**`.
  - **A directory / feature area** — e.g. "the auth module".
  - **The whole project (default)** — if no scope is given, default to the project's
    configured source. In QoQ mode that's `qoq.config.js`'s `srcPath`; otherwise infer
    from `tsconfig.json` `include` / `package.json` / the repo layout. Confirm the
    resolved set before proceeding — "whole project" on a monorepo can be large.

  Resolve to an explicit list you can hand to tools and subagents:

  ```bash
  git ls-files -- <path-or-glob> '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs'
  ```

  Everything downstream is bounded by this set. Read enough of the code to learn its
  natural seams (packages, directories, layers) — you'll divide work along them in
  Phase 2.

- **Use `.qoq/` as the workspace** (`mkdir -p .qoq`). When
  fanning out, each area gets its own subdirectory (`.qoq/<area>/`) so subagents never
  write to the same path. As `review`'s Phase 1 describes, temporarily add `.qoq/` to
  `.gitignore` so its patches and JSON reports don't pollute `git status` or trip the
  Prettier gate — you'll revert that ignore rule in Phase 5.
- **Size the scope and decide on subagents.** If the resolved set is small (a file or
  two, one small module), do the analysis yourself — skip the fan-out. If it's broad
  (several packages, a large directory, the whole project), it's too much for one agent
  to do well in a single pass and it parallelizes cleanly: **tell the user, be specific
  about how many subagents and how you'd divide the work, and ask permission.**

---

## Phase 2 — Orchestration (deltas)

Run the same seven analyses `review` defines, over the resolved scope. The only
addition is _how_ you run them at size. Note that Knip, JSCPD, and the sonarjs rule are
naturally whole-project tools — this is their native mode, no diff-filtering needed;
just keep findings inside the resolved scope.

**If the scope is small or subagents were declined:** run the seven dimensions
yourself, sequentially, exactly as `review`'s Phase 2 describes, writing patches into
`.qoq/` with the standard names. Go to Phase 3.

**If the scope is broad and subagents are approved, you are the orchestrator.** You
don't do the per-file analysis yourself — you divide, brief, collect, and regroup:

1. **Prime the shared reports once via the engine** so subagents read the compact
   digest instead of each re-running linters across the whole project (and instead of
   loading raw JSON into context):

   ```bash
   npx qoq --check --json --output .qoq/reports
   node <skill>/scripts/summarize.mjs .qoq/reports > .qoq/digest.txt
   ```

   `qoq` writes `eslint-report.json`, `knip-report.json`, `jscpd-report.json`,
   `prettier-report.json`; the summarizer collapses them into one digest grouped by
   tool and rule. Save the digest so every subagent reads it rather than the raw
   reports.

2. **Divide the scope by code area** into disjoint slices along the seams from Phase 1
   — one package, directory, or coherent module each. The cardinal rule: **no two
   slices may share a file.** Disjoint ownership is what lets subagents use the
   edit→restore patch recipe without trampling each other (see `review`'s "Producing a
   patch"). Aim for comparable sizes; split a very large package further.

3. **Dispatch one `qoq-analyzer` worker per slice.** `qoq-analyzer` is the shared
   analysis worker bundled at [../agents/qoq-analyzer.md](../agents/qoq-analyzer.md) —
   the single home of the "scope + checks → one reviewable patch" job that `review` and
   the engine dispatch to as well. Each worker runs **all seven dimensions** on its
   slice and writes patches into its own subdirectory. Dispatch via the Task tool
   (`subagent_type: qoq-analyzer` when registered; otherwise spawn a `general-purpose`
   subagent pointed at `agents/qoq-analyzer.md`), passing each:

   - **scope** — EXACTLY this slice's file list (touch nothing outside it);
   - **checks** — all seven dimensions;
   - **digest_path** — `.qoq/digest.txt` (the worker reads it for the
     ESLint/Knip/JSCPD findings, filtered to its file list, instead of re-running
     linters or opening raw JSON);
   - **tooling** — `<engine | project-tools | npx>`;
   - **output_dir** — `.qoq/<slice-name>/` (patches named
     `{spellings,dependencies,complexity,copy_paste,conventions,patterns,typescript}.patch`,
     skipping any dimension with no finding);
   - **references** — [review.md](review.md) (the seven dimensions + "Producing a
     patch"), [tool-playbook.md](tool-playbook.md), and [design-patterns.md](design-patterns.md).

   Each worker must operate in an **isolated worktree** or be strictly confined to its
   disjoint file list, and returns a one-line-per-dimension summary plus its patch
   paths.

4. **Keep the cross-cutting findings yourself.** Two dimensions can't be seen from
   inside a single slice, so the orchestrator owns them:
   - **Dependencies** — unused deps are project-wide. Read the **Knip section of the
     digest** and produce one `dependencies.patch` for the whole run.
   - **Cross-slice copy-paste** — duplication that spans two slices. Read the **JSCPD
     section of the digest** (drop to `jscpd-report.json` only for a clone's fragment
     text); a single-slice subagent only sees its half. Reconcile spanning clones into
     one coherent patch.

5. **Collect and regroup.** As subagents return, gather their patches and summaries —
   up to `slices × 6` files. Reconcile overlaps (don't keep two halves of one shared
   abstraction), then regroup by dimension for execution (Phase 4).

---

## Phase 3 — Present the plan & get approval (deltas)

Follow `review`'s Phase 3, but aggregate across all slices and surface the
cross-cutting work you reconciled (project-wide dependency cleanup, cross-slice
duplication).

One thing matters more here than in a diff review: **whole-project analysis surfaces a
long tail of low-value nitpicks.** Lead with the highest-value changes; when a
dimension has dozens of trivial findings, group them and let the user opt in or out
wholesale rather than listing every one. QoQ means you may recommend _dropping_
valid-but-low-value patches. Then ask whether they want to edit the plan or let you
execute it, and wait.

---

## Phase 4 — Execution (deltas)

Use `review`'s Phase 4 mechanics unchanged — `git apply --check` → `git apply` → run
the validation step after each, regenerate (don't force) a patch that stops applying,
stop and ask if validation goes red. The only difference is **grouping**: aggregate
each dimension's patches across all slices and apply **by dimension, lowest-risk
first**:

1. `spellings.patch` (all slices)
2. `dependencies.patch` (project-wide)
3. `complexity.patch` (all slices)
4. `copy_paste.patch` (all slices + cross-slice)
5. `conventions.patch` (all slices)
6. `patterns.patch` (all slices)
7. `typescript.patch` (all slices)

Because slices own disjoint files, patches _across_ slices rarely conflict; the
conflicts that do arise are between **dimensions touching the same file**, handled by
the regenerate step exactly as `review` describes.

---

## Phase 5 — Readability & cleanup (deltas)

Identical to `review`'s Phase 5: once everything is in
and green, format the changed files (`qoq --fix` / `qoq:fix` in QoQ mode, else
Prettier), run the validation step one final time, summarize what landed (ideally
grouped by area), then `rm -rf .qoq` to keep the intermediate patches and
reports out of the commit, and finally revert the temporary `.qoq/` entry
you added to `.gitignore` in Phase 1 (remove the block, or `git restore .gitignore`) so
the tree ends with only the refactor.

---

## Quick reference

- **Engine:** [review.md](review.md) (read it first — Step 0). All
  dimension/tooling/patch/execution detail lives there; this command only overrides
  scope, workspace name, and the fan-out strategy.
- **Scope:** user-chosen paths/globs/package, or the whole project (`srcPath`) by
  default — resolved to an explicit file list in Phase 1. Not a branch diff.
- **Orchestrator model:** broad scope + subagents approved → divide into disjoint
  code-area slices, brief one subagent per slice (all seven dimensions, reading
  `review.md`), keep dependencies and cross-slice duplication yourself, regroup, then
  execute by dimension.
- **Workspace:** `.qoq/` (per-area subdirs + `reports/`), removed in
  Phase 5.
- **Relationship to `review`:** same standards by construction; use `review` to vet a
  branch before merge, this one to improve a chosen area or the whole project on demand.
