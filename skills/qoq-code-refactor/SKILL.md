---
name: qoq-code-refactor
description: >-
  Refactor an existing JavaScript/TypeScript codebase in the QoQ "quality over
  quantity" spirit — the same analysis as qoq-code-review (spelling &
  intention-revealing naming, unused dependencies, cognitive complexity / SOLID,
  copy-paste duplication, code conventions (arrow functions over the `function`
  keyword, named exports over default), modern TypeScript idioms, and
  design-pattern code smells) but applied to a scope YOU choose rather than a
  branch diff. The scope
  can be one or more paths/globs, a package in the monorepo, a directory, or — by
  default — the whole project. Use this skill whenever the user wants to "clean
  up / refactor / tidy / improve / modernize" a file, folder, package, or the
  whole codebase, asks to "reduce complexity", "remove dead dependencies",
  "de-duplicate", "fix naming", or "apply our quality standards to <area>" — even
  when there is no branch to review and even if they don't say the word
  "refactor". For large scopes it runs as an orchestrator that fans the analysis
  out across subagents by code area, gathers every staged git patch, regroups
  them, and applies them one at a time behind the project's own lint/test/build.
  This is the broad, scope-driven sibling of `qoq-code-review` (which is
  branch-vs-base only); it reuses that skill's analysis engine rather than
  redefining it.
allowed-tools:
  - Task
  - Bash(npm run:*)
  - Bash(qoq:*)
  - Bash(npx qoq:*)
  - Bash(mkdir -p .qoq-code-refactor)
  - Bash(git diff:*)
  - Bash(git apply:*)
  - Bash(git restore:*)
  - Bash(git status:*)
  - Bash(git stash:*)
  - Bash(git log:*)
  - Bash(git ls-files:*)
metadata:
  version: 1.0.0
---

# qoq-code-refactor

This skill applies the QoQ code-quality analysis to a **scope you choose** — one or more paths/globs, a monorepo package, a directory, or, by default, the whole project — rather than to the changes a branch introduced. It uses no base branch and no diff.

It does **not** redefine the analysis. Everything about _how_ each quality dimension is detected and turned into a patch — the seven dimensions, the three tooling tiers, the `qoq`-report mapping, the edit→diff→restore→check patch recipe, the design-pattern catalog, and the apply/validate/regenerate execution mechanics — lives in the **`qoq-code-review`** skill, which is its single source of truth. This skill is a thin layer on top that changes two things:

1. **Where the work comes from** — a user-chosen _scope_ instead of a branch-vs-base diff.
2. **How the work is carried out at size** — an _orchestrator_ that fans the analysis across subagents by code area.

Reusing the sibling this way is deliberate: when `qoq-code-review`'s standards evolve (a new dimension, a sharper patch recipe), this skill inherits the change automatically — there is nothing here to keep in sync.

## Step 0 — Load the shared engine

Before doing anything, **read the `qoq-code-review` skill's `SKILL.md` in full** — it is the canonical definition of the analysis this skill performs. It's the `qoq-code-review` skill installed alongside this one; in this repository it sits at `skills/qoq-code-review/SKILL.md`, i.e. `../qoq-code-review/SKILL.md` relative to this skill's directory.

**`qoq-code-review` is a mandatory dependency — this is a hard gate, not a suggestion.** If you cannot locate it (no sibling skill, no `SKILL.md` at the relative path, and it's not in the available-skills list), **stop before any analysis or execution** and ask the user to install it first. Do **not** proceed, and do **not** paste in a remembered copy — that silently reintroduces the duplication this design exists to avoid, and it would drift from the real engine. Offer these install paths and let the user pick:

- **Claude skills marketplace (recommended)** — install the **`code-quality-skills`** plugin from the `qoq-agent-skills` marketplace (`/plugin` → add marketplace → add plugin). That plugin bundles `qoq-code-review` _and_ this skill, so it satisfies the dependency in one step.
- **`npx skills add qoq-code-review`** — the `skills` CLI installer, when you want just the dependency skill (use the marketplace's exact skill identifier if it differs).
- **`npx -p agent-skills-cli skills add qoq-code-review`** — same installer pinned via the `agent-skills-cli` package, for environments where `npx skills` doesn't resolve.

After the user confirms it's installed, re-check the path, read its `SKILL.md`, and only then continue.

Hold that document as the base procedure. Everything below is a **diff against it** — apply its instructions except where this file overrides them. The overrides, in one table:

| In `qoq-code-review`                                          | In this skill (`qoq-code-refactor`)                                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Scope = `git diff` of the branch vs. its base branch          | Scope = a **user-chosen** set of files (default: the whole project). See **Phase 1** below.          |
| "Ask for the base branch" / `git merge-base` / diff the range | **Skip entirely.** Resolve the scope instead.                                                        |
| "Only review the changed lines from Phase 1"                  | Analyse the **whole resolved scope**; report only findings inside it.                                |
| Workspace `.qoq-code-review/`                                 | Workspace `.qoq-code-refactor/` (per-area subdirectories underneath when fanning out).               |
| Optional fan-out **by dimension**                             | Orchestrated fan-out **by code area**. See **Phase 2** below.                                        |
| Patches live directly in the workspace root                   | Per-area patches live in `.qoq-code-refactor/<area>/`; the orchestrator regroups them for execution. |

Everything not in this table — the clean-tree check, QoQ-tier detection, validation-command discovery and green baseline, the seven dimensions and their tooling, the patch recipe, the design-patterns reference, the apply/validate loop, and the readability pass — you perform **exactly as `qoq-code-review` describes**, substituting the workspace directory name.

---

## Phase 1 — Scoping (deltas)

Follow `qoq-code-review`'s Phase 1, with these changes:

- **Keep:** the clean-working-tree check, the QoQ-tier detection, and the validation-command discovery + green baseline. They are unchanged.
- **Replace "ask for the base branch" + the `merge-base`/diff steps with scope resolution.** Ask the user what to refactor, unless they already said. Accept whichever form is natural and resolve it to a concrete file list:
  - **Paths / globs** — e.g. `packages/cli/src`, `src/**/*.ts`, a few named files.
  - **A monorepo package** — e.g. "the `knip` package" → `packages/knip/**`.
  - **A directory / feature area** — e.g. "the auth module".
  - **The whole project (default)** — if no scope is given, default to the project's configured source. In QoQ mode that's `qoq.config.js`'s `srcPath`; otherwise infer from `tsconfig.json` `include` / `package.json` / the repo layout. Confirm the resolved set before proceeding — "whole project" on a monorepo can be large.

  Resolve to an explicit list you can hand to tools and subagents:

  ```bash
  git ls-files -- <path-or-glob> '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs'
  ```

  Everything downstream is bounded by this set. Read enough of the code to learn its natural seams (packages, directories, layers) — you'll divide work along them in Phase 2.

- **Use `.qoq-code-refactor/` as the workspace** (`mkdir -p .qoq-code-refactor`). When fanning out, each area gets its own subdirectory so subagents never write to the same path. As `qoq-code-review`'s Phase 1 describes (substituting this workspace name), temporarily add `.qoq-code-refactor/` to `.gitignore` so its patches and JSON reports don't pollute `git status` or trip the Prettier gate — you'll revert that ignore rule in Phase 5.
- **Size the scope and decide on subagents.** If the resolved set is small (a file or two, one small module), do the analysis yourself — skip the fan-out. If it's broad (several packages, a large directory, the whole project), it's too much for one agent to do well in a single pass and it parallelizes cleanly: **tell the user, be specific about how many subagents and how you'd divide the work, and ask permission.** Recommend it whenever the scope feels too big for one agent.

---

## Phase 2 — Orchestration (deltas)

Run the same seven analyses `qoq-code-review` defines, over the resolved scope. The only addition is _how_ you run them at size. Note that Knip, JSCPD, and the sonarjs rule are naturally whole-project tools — this is their native mode, no diff-filtering needed; just keep findings inside the resolved scope.

**If the scope is small or subagents were declined:** run the seven dimensions yourself, sequentially, exactly as `qoq-code-review`'s Phase 2 describes, writing patches into `.qoq-code-refactor/` with the standard names. You're done with this phase — go to Phase 3.

**If the scope is broad and subagents are approved, you are the orchestrator.** You don't do the per-file analysis yourself — you divide, brief, collect, and regroup:

1. **Prime the shared reports once (QoQ mode)** so subagents read JSON instead of each re-running linters across the whole project:

   ```bash
   qoq --json --output .qoq-code-refactor/reports
   ```

   This writes `eslint-report.json`, `knip-report.json`, `jscpd-report.json`, `prettier-report.json`.

2. **Divide the scope by code area** into disjoint slices along the seams from Phase 1 — one package, directory, or coherent module each. The cardinal rule: **no two slices may share a file.** Disjoint ownership is what lets subagents use the edit→restore patch recipe without trampling each other (see `qoq-code-review`'s "Producing a patch"). Aim for comparable sizes; split a very large package further.

3. **Brief one subagent per slice.** Each runs **all seven dimensions** on its slice and writes patches into its own subdirectory. Give each this brief:

   ```
   Refactor a slice of this project in the QoQ "quality over quantity" spirit.
   - FIRST read the qoq-code-review skill's SKILL.md (installed alongside the
     qoq-code-refactor skill, at ../qoq-code-review/SKILL.md). Its "Phase 2 —
     Analysis" (the seven dimensions + the "Producing a patch" recipe) and
     "Tooling: prefer qoq" are your procedure. Apply them to your file list
     instead of to a branch diff.
   - Your scope is EXACTLY these files (touch nothing outside them):
     <explicit file list for this slice>
   - QoQ tier in effect: <qoq | project-tools | npx>. If QoQ mode, combined
     reports are at .qoq-code-refactor/reports/ — read them, don't re-run
     linters; filter every finding to your file list.
   - Produce one patch per dimension that has findings (MINIMUM change, project
     code standards). Use edit → diff → restore → check so your tree ends clean.
   - Save to: .qoq-code-refactor/<slice-name>/{spellings,dependencies,complexity,
     copy_paste,conventions,patterns,typescript}.patch  (skip any dimension with no finding).
   - Return a short per-dimension summary (one line each) + the patch paths.
   ```

   Each subagent must work in an **isolated worktree** or be strictly confined to its disjoint file list.

4. **Keep the cross-cutting findings yourself.** Two dimensions can't be seen from inside a single slice, so the orchestrator owns them rather than asking a slice to guess:
   - **Dependencies** — unused deps are project-wide. Read `knip-report.json` (or `qoq knip`) and produce one `dependencies.patch` for the whole run.
   - **Cross-slice copy-paste** — duplication that spans two slices. Read `jscpd-report.json` (or `qoq jscpd`); a single-slice subagent only sees its half. Reconcile spanning clones into one coherent patch.

5. **Collect and regroup.** As subagents return, gather their patches and summaries — up to `slices × 6` files. Reconcile overlaps (don't keep two halves of one shared abstraction), then regroup by dimension for execution (Phase 4).

---

## Phase 3 — Present the plan & get approval (deltas)

Follow `qoq-code-review`'s Phase 3, but aggregate across all slices and surface the cross-cutting work you reconciled (project-wide dependency cleanup, cross-slice duplication).

One thing matters more here than in a diff review: **whole-project analysis surfaces a long tail of low-value nitpicks.** Lead with the highest-value changes; when a dimension has dozens of trivial findings, group them and let the user opt in or out wholesale rather than listing every one. QoQ means you may recommend _dropping_ valid-but-low-value patches. Then ask whether they want to edit the plan or let you execute it, and wait.

---

## Phase 4 — Execution (deltas)

Use `qoq-code-review`'s Phase 4 mechanics unchanged — `git apply --check` → `git apply` → run the validation step after each, regenerate (don't force) a patch that stops applying, stop and ask if validation goes red. The only difference is **grouping**: aggregate each dimension's patches across all slices and apply **by dimension, lowest-risk first**:

1. `spellings.patch` (all slices)
2. `dependencies.patch` (project-wide)
3. `complexity.patch` (all slices)
4. `copy_paste.patch` (all slices + cross-slice)
5. `conventions.patch` (all slices)
6. `patterns.patch` (all slices)
7. `typescript.patch` (all slices)

Because slices own disjoint files, patches _across_ slices rarely conflict; the conflicts that do arise are between **dimensions touching the same file**, handled by the regenerate step exactly as the sibling describes.

---

## Phase 5 — Readability & cleanup (deltas)

Identical to `qoq-code-review`'s Phase 5, substituting the workspace name: once everything is in and green, format the changed files (`qoq --fix` / `qoq:fix` in QoQ mode, else Prettier), run the validation step one final time, summarize what landed (ideally grouped by area), then `rm -rf .qoq-code-refactor` to keep the intermediate patches and reports out of the commit, and finally revert the temporary `.qoq-code-refactor/` entry you added to `.gitignore` in Phase 1 (remove the block, or `git restore .gitignore`) so the tree ends with only the refactor.

---

## Quick reference

- **Engine:** `qoq-code-review`'s `SKILL.md` (read it first — Step 0). All dimension/tooling/patch/execution detail lives there; this skill only overrides scope, workspace name, and the fan-out strategy. It is a **mandatory dependency** — if it isn't installed, stop and have the user add it (the `code-quality-skills` plugin from the `qoq-agent-skills` marketplace bundles both; or `npx skills add qoq-code-review` / `npx -p agent-skills-cli skills add qoq-code-review`) before running.
- **Scope:** user-chosen paths/globs/package, or the whole project (`srcPath`) by default — resolved to an explicit file list in Phase 1. Not a branch diff.
- **Orchestrator model:** broad scope + subagents approved → divide into disjoint code-area slices, brief one subagent per slice (all seven dimensions, reading the sibling skill), keep dependencies and cross-slice duplication yourself, regroup, then execute by dimension.
- **Workspace:** `.qoq-code-refactor/` (per-area subdirs + `reports/`), removed in Phase 5.
- **Relationship to `qoq-code-review`:** same standards by construction; use the review skill to vet a branch before merge, this one to improve a chosen area or the whole project on demand.
