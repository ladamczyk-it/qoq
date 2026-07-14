# refactor

Applies the QoQ analysis to a **scope you choose** — one or more paths/globs, a
monorepo package, a directory, or, by default, the whole project — rather than
to the changes a branch introduced. No base branch, no diff.

The analysis is the shared seven dimensions ([analysis.md](analysis.md)); the
staging/apply/cleanup mechanics are the shared workflow
([workflow.md](workflow.md)). This file owns only what is refactor-specific:
resolving the scope, and orchestrating the work **by code area** when the
scope is too big for one pass.

---

## Phase 1 — Scoping

Setup already confirmed a clean tree and located the engine.

1. **Resolve the scope.** Ask the user what to refactor, unless they already
   said. Accept whichever form is natural and resolve it to a concrete file
   list:
   - **Paths / globs** — e.g. `packages/cli/src`, `src/**/*.ts`, named files.
   - **A monorepo package** — e.g. "the `knip` package" → `packages/knip/**`.
   - **A directory / feature area** — e.g. "the auth module".
   - **The whole project (default)** — when no scope is given, default to the
     project's configured source: `qoq.config.js`'s `srcPath` in QoQ mode,
     otherwise infer from `tsconfig.json` `include` / `package.json` / the repo
     layout. Confirm the resolved set before proceeding — "whole project" on a
     monorepo can be large.

   ```bash
   git ls-files -- <path-or-glob> '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs'
   ```

   Everything downstream is bounded by this list. Read enough of the code to
   learn its natural seams (packages, directories, layers) — work divides along
   them in Phase 2.

2. **Size the scope and decide on fan-out.** A file or two, one small module —
   do the analysis yourself, sequentially. Several packages, a large directory,
   the whole project — too much for one agent to do well in a single pass, and
   it parallelizes cleanly by area. If the user hasn't already allowed or
   declined subagents, tell them how many you'd use and how you'd divide the
   work, and ask — a broad fan-out is worth one question.

3. **Initialize the workspace, take the snapshot, discover the validation
   commands, and confirm the green baseline** per
   [workflow.md](workflow.md). When fanning out, each area gets its own
   subdirectory (`.qoq/<area>/`) so workers never write to the same path.

---

## Phase 2 — Orchestration

Run the seven dimensions from [analysis.md](analysis.md) over the resolved
scope. Knip, JSCPD, and the sonarjs rule are naturally whole-project tools —
this is their native mode; just keep findings inside the scope.

**Small scope, or subagents declined:** run the dimensions yourself,
sequentially, staging patches into `.qoq/` with the standard names. Go to
Phase 3.

**Broad scope with subagents approved — you are the orchestrator.** You don't
do the per-file analysis yourself; you divide, brief, collect, and regroup:

1. **Prime the shared reports once** via the engine, and save the digest so
   every worker reads it instead of re-running linters or loading raw JSON:

   ```bash
   npx qoq --check --json --output .qoq/reports
   node <skill>/scripts/summarize.mjs .qoq/reports > .qoq/digest.txt
   ```

2. **Divide the scope by code area** into disjoint slices along the Phase 1
   seams — one package, directory, or coherent module each. The cardinal rule:
   **no two slices may share a file.** Disjoint ownership is what lets workers
   stage patches without trampling each other. Aim for comparable sizes; split
   a very large package further.

3. **Dispatch one `qoq-analyzer` worker per slice**
   ([../agents/qoq-analyzer.md](../agents/qoq-analyzer.md); via the Task tool
   with `subagent_type: qoq-analyzer` when registered, else a `general-purpose`
   subagent pointed at that file). Pass each: its **scope** (exactly this
   slice's file list), **checks** = all seven dimensions, **digest_path** =
   `.qoq/digest.txt`, the **tooling** mode, **output_dir** = `.qoq/<slice>/`,
   and the references ([analysis.md](analysis.md),
   [tool-playbook.md](tool-playbook.md),
   [design-patterns.md](design-patterns.md)). Each worker returns a
   one-line-per-dimension summary plus its patch paths.

4. **Keep the cross-cutting findings yourself** — two dimensions can't be seen
   from inside a single slice:
   - **Dependencies** — unused deps are project-wide. Read the Knip section of
     the digest and produce one `dependencies.patch` for the whole run.
   - **Cross-slice copy-paste** — a clone spanning two slices; each worker only
     sees its half. Read the JSCPD section of the digest and reconcile spanning
     clones into one coherent patch (read the duplicated code from the source
     files at the reported line ranges).

5. **Collect and regroup.** Gather the workers' patches and summaries,
   reconcile overlaps (don't keep two halves of one shared abstraction), then
   regroup by dimension for execution.

---

## Phase 3 — Present the plan & get approval

Present as `review` does — grouped by dimension, one-line rationale, size,
dropped findings — but aggregate across slices and surface the cross-cutting
work (project-wide dependency cleanup, cross-slice duplication).

One thing matters more here than in a diff review: **whole-project analysis
surfaces a long tail of low-value nitpicks.** Lead with the highest-value
changes; when a dimension has dozens of trivial findings, group them and let
the user opt in or out wholesale rather than listing every one. QoQ means you
may recommend _dropping_ valid-but-low-value patches. Then ask whether to edit
the plan or execute it, and wait.

---

## Phase 4 — Execution

Aggregate each dimension's patches across all slices and apply **by dimension**
in the canonical order, exactly per
[workflow.md](workflow.md#applying-patches). Because slices own disjoint
files, patches _across_ slices rarely conflict; the conflicts that do arise are
between dimensions touching the same file, handled by the regenerate rule.

---

## Phase 5 — Readability & cleanup

Format the changed files (`qoq --fix` / `qoq:fix` in QoQ mode, else Prettier),
run the validation step one final time, summarize what landed (ideally grouped
by area), then clean up per [workflow.md](workflow.md#cleanup).

---

## Quick reference

- **Scope:** user-chosen paths/globs/package, or the whole project (`srcPath`)
  by default — resolved to an explicit file list in Phase 1. Not a branch diff.
- **Orchestrator model:** broad scope → disjoint code-area slices, one
  `qoq-analyzer` per slice running all seven dimensions; the orchestrator keeps
  dependencies and cross-slice duplication, regroups, then executes by
  dimension.
- **Relationship to `review`:** same standards by construction
  ([analysis.md](analysis.md)); use `review` to vet a branch before merge, this
  one to improve a chosen area or the whole project on demand.
