# review

A code review is only useful if it changes the code that ships. This command
turns a review into a set of **small, reviewable, revertible** improvements
rather than a wall of prose the author has to re-implement by hand. The guiding
value is QoQ — _quality over quantity_: a few high-confidence,
intention-revealing changes over a long list of nitpicks.

What it reviews is **the change a branch introduces** against its base. The
analysis itself is the shared seven dimensions
([analysis.md](analysis.md)); the staging/apply/cleanup mechanics are the
shared workflow ([workflow.md](workflow.md)). Unlike `fix`/`gate`, one of
those seven — design patterns — moves out to a third-party skill for
`review`, and a new minimalism/over-engineering lens (never an in-house
dimension) is added alongside it; see [delegation.md](delegation.md) for the
mechanism, shared verbatim with `refactor`. This file owns only what is
review-specific: scoping to the branch diff, the optional per-dimension
fan-out, and the approval flow.

The flow separates **planning** from **executing**: first stage every
suggestion as a patch without touching the working tree and get the user's
sign-off; only then apply, one patch at a time behind the project's
lint/test/build.

---

## Phase 1 — Discovery

Setup already confirmed a clean tree and located the engine
([engine.md](engine.md)).

1. **Establish the base branch.** Infer it rather than opening with a question:
   `git symbolic-ref refs/remotes/origin/HEAD` names the default branch, and
   the user may already have said (or the request implies) something else.
   State your choice in passing — "reviewing against `master`, tell me if the
   base should differ" — and only stop to ask when the inference is genuinely
   ambiguous (e.g. long-lived `develop` + `main` both plausible).

2. **Scope the diff.** Compute the real change set against the merge-base so
   you review what the branch introduced, not unrelated commits on the base:

   ```bash
   git merge-base <base> HEAD
   git diff --stat $(git merge-base <base> HEAD)..HEAD
   git diff $(git merge-base <base> HEAD)..HEAD -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs'
   ```

   Read the diff. Note which files are new, which are modified, and which areas
   are the substance of the change. The review covers these changed lines and
   the files they touch — not the whole repo.

3. **Decide on fan-out.** The six internally-owned analyses in Phase 2 are
   independent, so on a sizable diff they parallelize cleanly — one
   `qoq-analyzer` worker per dimension. Decide from the diff size: a handful
   of files is faster done yourself, sequentially; a broad diff justifies
   subagents. If the user has already said whether subagents are allowed,
   honor that; otherwise mention the choice you made rather than pausing to
   ask ("diff is 4 files — running the dimensions sequentially"). The two
   external lenses ([delegation.md](delegation.md)) always run as their own
   dispatch regardless of this decision — they're one call each, not per
   dimension.

4. **Initialize the workspace and take the snapshot**, then **discover the
   validation commands and confirm the green baseline** — all exactly as
   [workflow.md](workflow.md) describes. Red test/build is a stop-and-ask; a
   red lint digest is not — the project-wide `qoq --check` almost always has
   _some_ finding, often inside the very diff you're about to review, and
   that's Phase 2's material, not a blocker
   ([workflow.md](workflow.md#validation-commands--the-green-baseline)).

---

## Phase 2 — Analysis

One of the seven shared dimensions — design patterns — is delegated to a
third-party skill for `review`, and a new minimalism/over-engineering lens
(never part of the seven) is added alongside it — unlike `fix`/`gate`, which
still run the original seven entirely in-house. See
[delegation.md](delegation.md) for the full mechanism. This phase covers both
halves: the six dimensions qoq still owns itself, then the two lenses.

### The six internally-owned dimensions

Run six of the seven from [analysis.md](analysis.md) over the Phase 1 diff —
spelling & naming, dependencies, complexity/SOLID, copy-paste, conventions,
and TypeScript idioms (skip that last one for plain JS) — **not** design
patterns, which Lens B below covers instead. Prime the engine reports once and
read the digest, then **filter its findings down to the files and lines the
diff identified** — `qoq` scans the whole configured `srcPath`, and this
branch only answers for what it changed. Knip is whole-project by nature;
report only the unused deps/exports _this branch_ introduced.

Each dimension with a real finding becomes one patch, staged via
`stage-patch.mjs` ([workflow.md](workflow.md#staging-a-patch)) so the tree
stays untouched until Phase 4. If a dimension yields nothing worth changing,
say so and skip its patch.

**Fanning out:** dispatch one `qoq-analyzer` per dimension via the Task tool
(`subagent_type: qoq-analyzer` when registered — see
[../agents/qoq-analyzer.md](../agents/qoq-analyzer.md); otherwise spawn a
`general-purpose` subagent and have it read that file as its instructions).
Pass each worker: its **scope** (the diff's files), its **checks** (the one
dimension), the **digest path**, the **tooling** mode, the **output dir**
(`.qoq/`), and the reference files it needs — always
[analysis.md](analysis.md) and [tool-playbook.md](tool-playbook.md);
[design-patterns.md](design-patterns.md) is no longer needed here since that
dimension moved to Lens B. Workers stage patches and report back; they never
apply anything or run the gate — that stays here. Since all six share the
diff's files, workers must run in isolated worktrees, or run the dimensions
sequentially yourself ([workflow.md](workflow.md#staging-a-patch), parallel
staging rule).

### The two external lenses

In addition to the six dimensions above, fan out Lens A (`ponytail-review`)
and Lens B (`design-pattern-review`) over the **same Phase 1 diff** — check
both are installed, dispatch each on its configured tier, and turn their
findings into `minimalism.patch` / `patterns.patch`, all exactly as
[delegation.md](delegation.md) describes. These two dispatches don't need
isolated worktrees the way the six-dimension workers do — a lens only reports
findings, it never edits the tree itself; only the conversion-to-patch step
touches files, and that happens here, sequentially, same as any other patch.
If a lens is missing and the user declines to install it, proceed with
whatever's left (per [delegation.md](delegation.md#checking-availability-first))
and carry the skip note into Phase 3.

---

## Phase 3 — Present the plan & get approval

Summarize what each analysis found and what its patch would change — grouped by
dimension, each with a one-line rationale and a sense of size (lines/files
touched). Include the findings you _dropped_ and why
([analysis.md](analysis.md#quality-over-quantity--keeping-vs-dropping-a-finding)).
If either external lens was skipped for a missing skill, say so here too — the
plan should read like a report that ran with fewer lenses, not one that quietly
covered less ground. Keep it scannable; this is the user's chance to steer.

Then ask whether they want to **edit the plan** (drop or adjust specific
patches) or whether you may **execute it**. Wait for an answer. Don't apply
anything yet.

---

## Phase 4 — Execution

Apply the approved patches exactly as
[workflow.md](workflow.md#applying-patches) describes: sequentially, in the
canonical dimension order, `git apply --check` → `git apply` → validation step
after each, regenerating (never forcing) a patch that no longer applies, and
stopping to report if validation goes red. Then apply `minimalism.patch`, if
staged, last of all — per
[delegation.md](delegation.md#where-the-new-patch-fits-in-the-apply-order),
same regenerate/red-baseline rules apply to it.

---

## Phase 5 — Readability & cleanup

Highly readable code follows one consistent format, so once all approved
patches are in and green, format the changed files with the project's
formatter — in QoQ mode that's the same `qoq --fix` / `qoq:fix` discovered in
Setup (it runs Prettier and the other auto-fixers with the project's exact
config in one pass); otherwise `npx prettier --write` on the changed paths.
Run the validation step one final time so the formatted result is confirmed
green, then summarize what landed.

Finally clean up per [workflow.md](workflow.md#cleanup): on a fully successful
run, `workspace.mjs cleanup` leaves a tree containing exactly the applied
improvements, ready to commit; on an aborted run, leave the workspace in place
as the record of what's left.
