# refactor

Applies the QoQ analysis to a **scope you choose** — one or more paths/globs, a
monorepo package, a directory, or, by default, the whole project — rather than
to the changes a branch introduced. No base branch, no diff.

The analysis is the shared seven dimensions ([analysis.md](analysis.md)); the
staging/apply/cleanup mechanics are the shared workflow
([workflow.md](workflow.md)). Unlike `fix`/`gate`, one of those seven —
design patterns — moves out to a third-party skill for `refactor`, and a new
minimalism/over-engineering lens (never an in-house dimension) is added
alongside it; see [delegation.md](delegation.md) for the mechanism, shared
verbatim with `review`. This file owns only what is refactor-specific:
resolving the scope, and orchestrating the work **by code area** when the
scope is too big for one pass.

---

## Phase 1 — Scoping

Setup already confirmed a clean tree — or, under `--tree dirty`, deliberately
didn't ([Run modes](workflow.md#run-modes--tree-and-decisions)) — and located
the engine.

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
     monorepo can be large. **This default is off under `--tree dirty`:** a
     caller running against uncommitted work must name its scope, or the run
     silently absorbs unrelated dirty files it doesn't own. No scope plus
     `--tree dirty` is a caller error — say so instead of guessing.

   ```bash
   git ls-files -- <path-or-glob> | grep -E '\.(ts|tsx|js|jsx|mjs|cjs)$'
   ```

   **Don't pass the extension globs as extra `git ls-files` pathspecs** (e.g.
   `git ls-files -- <path-or-glob> '*.ts' '*.tsx' …`) — multiple pathspecs
   union rather than intersect, so that form silently returns every `.ts`/
   `.js` file in the whole repo in addition to `<path-or-glob>`, not the
   `<path-or-glob>`'s TS/JS files. Piping through `grep` is what actually
   intersects path and extension.

   Everything downstream is bounded by this list. Read enough of the code to
   learn its natural seams (packages, directories, layers) — work divides along
   them in Phase 2.

2. **Size the scope and decide on fan-out.** A file or two, one small module —
   do the analysis yourself, sequentially. Several packages, a large directory,
   the whole project — too much for one agent to do well in a single pass, and
   it parallelizes cleanly by area. If the user hasn't already allowed or
   declined subagents, tell them how many you'd use and how you'd divide the
   work, and ask — a broad fan-out is worth one question. Under
   `--decisions auto` there's nobody to ask: decide from the resolved scope
   alone, which for a caller-supplied file list means analyzing sequentially.

3. **Initialize the workspace, take the snapshot, discover the validation
   commands, and confirm the green baseline** per
   [workflow.md](workflow.md). When fanning out, each area gets its own
   subdirectory (`<ws>/<area>/`) so workers never write to the same path.

---

## Phase 2 — Orchestration

Run six of the seven dimensions from [analysis.md](analysis.md) over the
resolved scope — spelling & naming, dependencies, complexity/SOLID,
copy-paste, conventions, TypeScript idioms — **not** design patterns, which is
delegated to Lens B further down (this is refactor's own checks list; `fix`
borrows this phase's dividing/dispatching mechanics below but keeps its own
seven-dimension checks, unaffected by this). Knip, JSCPD, and the sonarjs rule
are naturally whole-project tools — this is their native mode; just keep
findings inside the scope.

**Small scope, or subagents declined:** run the six dimensions yourself,
sequentially, staging patches into `.qoq/` with the standard names. Then go
straight to [the two external lenses](#the-two-external-lenses) below — those
run regardless of scope size, since they're one dispatch each, not one per
file or dimension.

**Broad scope with subagents approved — you are the orchestrator.** You don't
do the per-file analysis yourself; you divide, brief, collect, and regroup:

1. **Prime the shared reports once** via the engine, and save the digest so
   every worker reads it instead of re-running linters or loading raw JSON:

   ```bash
   npx qoq --check --json --output <ws>/reports
   node <skill>/scripts/summarize.mjs <ws>/reports > <ws>/digest.txt
   ```

2. **Divide the scope by code area** into disjoint slices along the Phase 1
   seams — one package, directory, or coherent module each. The cardinal rule:
   **no two slices may share a file.** Disjoint ownership is what lets workers
   stage patches without trampling each other. Aim for comparable sizes; split
   a very large package further.

3. **Dispatch one `qoq-analyzer` worker per slice**
   ([../agents/qoq-analyzer.md](../agents/qoq-analyzer.md); via the Agent tool
   with `subagent_type: qoq-analyzer` when registered, else a `general-purpose`
   subagent pointed at that file). Pass each: its **scope** (exactly this
   slice's file list), **checks** = the six dimensions above, **digest_path** =
   `<ws>/digest.txt`, the **tooling** mode, **output_dir** = `<ws>/<slice>/`,
   and the references — [analysis.md](analysis.md) and
   [tool-playbook.md](tool-playbook.md) always;
   [design-patterns.md](design-patterns.md) is not needed here since that
   dimension isn't in scope for these workers (pass it only for a worker whose
   `checks` includes the design-patterns dimension — that's `fix`'s case, not
   this one). Each worker returns a one-line-per-dimension summary plus its
   patch paths.

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

### The two external lenses

Whether or not the six dimensions above were fanned out, dispatch Lens A
(`ponytail-review`) and Lens B (`design-pattern-review`) once each over the
**whole resolved scope** — not per slice, a lens skill manages its own
traversal. Check both are installed, dispatch each on its configured tier, and
turn their findings into `minimalism.patch` / `patterns.patch`, all exactly as
[delegation.md](delegation.md) describes. If a lens is missing and the user
declines to install it, proceed with whatever's left
([delegation.md](delegation.md#checking-availability-first)) and carry the
skip note into Phase 3.

---

## Phase 3 — Present the plan & get approval

**Under `--decisions auto`, skip this phase entirely** and go straight to
Phase 4 with the safe tier only, per
[Run modes](workflow.md#run-modes--tree-and-decisions). The advisory tier —
along with any lens that was skipped for a missing skill, and any finding that
would have edited a file outside the resolved scope — becomes the structured
report you return at the end instead of a plan you present now. Everything
below is the `human` default.

Present as `review` does — grouped by dimension, one-line rationale, size,
dropped findings — but aggregate across slices and surface the cross-cutting
work (project-wide dependency cleanup, cross-slice duplication).

One thing matters more here than in a diff review: **whole-project analysis
surfaces a long tail of low-value nitpicks.** Lead with the highest-value
changes; when a dimension has dozens of trivial findings, group them and let
the user opt in or out wholesale rather than listing every one. QoQ means you
may recommend _dropping_ valid-but-low-value patches. If either external lens
was skipped for a missing skill, say so here too. Then ask whether to edit the
plan or execute it, and wait.

---

## Phase 4 — Execution

Aggregate each dimension's patches across all slices and apply **by dimension**
in the canonical order, exactly per
[workflow.md](workflow.md#applying-patches). Because slices own disjoint
files, patches _across_ slices rarely conflict; the conflicts that do arise are
between dimensions touching the same file, handled by the regenerate rule.
Apply `minimalism.patch`, if staged, last of all — per
[delegation.md](delegation.md#where-the-new-patch-fits-in-the-apply-order).

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
  `qoq-analyzer` per slice running six of the seven dimensions; the
  orchestrator keeps dependencies and cross-slice duplication, regroups, then
  executes by dimension. Design patterns and minimalism come from two
  separately-dispatched external lenses over the whole scope, not from a
  slice worker — see [delegation.md](delegation.md).
- **Relationship to `review`:** same standards by construction
  ([analysis.md](analysis.md)), same external-lens delegation
  ([delegation.md](delegation.md)); use `review` to vet a branch before merge,
  this one to improve a chosen area or the whole project on demand.
