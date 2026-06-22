---
name: qoq
description: >-
  QoQ "quality over quantity" toolkit for JavaScript/TypeScript projects. Four
  user-facing commands plus a `gate` other skills call. Use `review` to review the changes on a branch against
  a base branch (spelling & intention-revealing naming, unused dependencies,
  cognitive complexity / SOLID, copy-paste duplication, code conventions, modern
  TypeScript idioms, design-pattern smells). Use `refactor` to run that same
  analysis over a scope YOU choose — a path, a package, a directory, or the
  whole project — when there is no branch to diff. Use `bump packages` to safely
  update npm dependencies in stages (minor/patch first, then majors one major at
  a time with changelog research). Use `fix` to concentrate on _fixing_ findings:
  it reuses the `gate` engine to run `qoq --check` over the full project (or a
  chosen scope) and stages every fix — both the safe tier and the judgment calls `gate` only
  reports — as reviewable git patches applied one at a time behind the project's
  lint/test/build gate. Trigger whenever the user wants to "review my
  branch/diff/PR", check if changes are "ready to merge", "clean up / refactor /
  tidy / modernize" a file/folder/package/codebase, "reduce complexity", "remove
  dead dependencies", "de-duplicate", "fix naming", "fix the findings / lint
  errors / issues", "apply our quality standards to <area>", or "update / upgrade
  / bump dependencies" / "get on the latest versions" — even if they don't name
  the command. Use `gate` (and have other
  skills call it) to check freshly produced code against the QoQ standards and
  auto-fix it before declaring a task done — a non-interactive quality gate over
  the working-tree changes that returns a PASS/FAIL verdict. Every suggestion is
  staged as a reviewable git patch and applied one at a time behind the project's
  own lint/test/build gate, so a bad change is easy to isolate and revert.
argument-hint: '[review|refactor|fix|bump packages|gate] [target]'
user-invocable: true
allowed-tools:
  - Task
  - Bash(npm run:*)
  - Bash(npm outdated *)
  - Bash(npm i *)
  - Bash(qoq:*)
  - Bash(npx qoq:*)
  - Bash(node:*)
  - Bash(mkdir -p .qoq)
  - Bash(mkdir -p .qoq/reports)
  - Bash(git diff:*)
  - Bash(git merge-base:*)
  - Bash(git apply:*)
  - Bash(git restore:*)
  - Bash(git checkout:*)
  - Bash(git stash:*)
  - Bash(git status:*)
  - Bash(git log:*)
  - Bash(git ls-files:*)
  - Bash(cat package.json)
  - Bash(ls:*)
metadata:
  version: 1.0.0
---

Applies the QoQ — _quality over quantity_ — standard to a JS/TS codebase: a few
high-confidence, intention-revealing changes over a long list of nitpicks. Every
suggestion is staged as a reviewable git patch and applied one at a time behind
the project's own lint/test/build gate.

## Setup

Two things are true for **every** command, so establish them before routing into
one. They are the shared engine that `review`, `refactor`, `fix`, `bump packages`,
and `gate` all build on.

1. **Confirm a clean working tree.** Run `git status`. Most commands edit files
   and revert them as their safety net, so a dirty tree gets tangled in that. If
   there are uncommitted changes, point them out and ask the user to commit,
   stash, or confirm stashing is fine before continuing. **Exception: `gate` and
   `fix`.** Both lean on a `git stash create` snapshot as their safety net instead
   of demanding a clean tree, so they tolerate uncommitted work. `gate`'s scope _is_
   the producer's dirty working tree; `fix`'s scope is the **full project** (or a
   scope you name) — it runs `qoq --check` over the whole codebase and never scans
   for modified files (see [reference/gate.md](reference/gate.md) and
   [reference/fix.md](reference/fix.md)).

2. **Locate the QoQ engine.** The linters and formatters (Prettier, ESLint,
   Knip, JSCPD, Stylelint) and their `--json` digest are owned by one place —
   [reference/engine.md](reference/engine.md). Work out how `qoq` is invoked in
   this project (a `qoq:check` / `qoq:fix` npm script, `npx qoq`, or a build-first
   monorepo) and read its config, exactly as that file describes. Every command
   that needs tool-backed findings (`review`, `refactor`, `fix`) or a lint gate
   (all of them) defers to the engine rather than re-deriving flags or parsing raw
   reports. If a project has no `qoq` set up at all, the engine documents the
   fallback to the project's own ESLint/Knip/JSCPD/Prettier scripts.

Skipping these produces output that fights the project's own tools or corrupts
the patch workflow's safety net.

## Shared principles

These hold across every command; the command reference is the source of
truth for everything specific.

- **One shared workspace, `.qoq/`.** Every command stages its patches, reports,
  and digest under a single `.qoq/` directory at the repo root, git-ignored for
  the duration of the run (a labeled block each command adds to `.gitignore` and
  reverts at the end) so its scratch files never show up in `git status` or trip
  the Prettier gate. On a fully successful run the command removes `.qoq/`
  entirely, leaving only the real code change; on an aborted run it leaves `.qoq/`
  in place as the record of what's left.
- **Plan, then execute.** Gather everything and stage each change as a
  `git apply`-able patch in `.qoq/` **without touching the working tree**; get the
  user's sign-off; only then apply.
- **One patch at a time.** Apply patches sequentially, re-running the validation
  gate (the project's lint/test/build) after each, so any breakage is
  attributable to exactly one patch and trivially reverted.
- **Patches via edit → diff → restore → check.** Edit in place, capture with
  `git diff > <workspace>/<name>.patch`, `git restore` to keep the tree clean,
  then `git apply --check` to confirm it applies. A malformed patch is
  regenerated, never forced.
- **Quality over quantity.** An empty result is a fine result. Recommend
  _dropping_ valid-but-low-value patches. A short list of confident fixes beats a
  churn of nitpicks.
- **Stop at decision points.** These commands mutate a real repo. Pause at the
  marked approval points rather than pushing through — but if the user has
  already stated preferences (base branch, scope, excluded packages, whether
  subagents are allowed, whether to auto-apply), honor them and don't re-ask.
  **`gate` is the deliberate exception:** it runs to completion without
  interactive approval (its caller already authorized it), auto-applying only the
  safe fixes and reporting the judgment calls as advisories rather than blocking.

## Commands

| Command         | Description                                                                                     | Reference                                      |
| --------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `review`        | Review a branch's changes against a base branch and stage fixes as patches                      | [reference/review.md](reference/review.md)     |
| `refactor`      | Run the same analysis over a scope you choose (path/package/directory/whole project)            | [reference/refactor.md](reference/refactor.md) |
| `fix`           | Fix findings over the full project / chosen scope — stage both tiers as patches behind the gate | [reference/fix.md](reference/fix.md)           |
| `bump packages` | Safely update npm dependencies in stages — minor/patch first, then majors one at a time         | [reference/bump.md](reference/bump.md)         |
| `gate`          | Non-interactive quality gate over a producer's just-written changes; returns PASS/FAIL          | [reference/gate.md](reference/gate.md)         |

`gate` is the **integration entry point** — the command another skill (or you,
mid-task) calls before declaring work done. It auto-fixes against the standards
and returns a verdict rather than running an interactive plan. See
[Consuming `/qoq` from another skill](#consuming-qoq-from-another-skill).

`fix` is gate's **interactive, patch-first sibling.** It reuses the same gate
engine (the `git stash create` snapshot, the seven-dimension analysis) over the
**full project** (or a chosen scope) — running `qoq --check`, not scanning for
modified files — but instead of silently auto-applying the safe tier and merely _reporting_
the judgment calls, it stages **every** fix — both tiers — as a reviewable git
patch, then applies the approved ones one at a time behind the validation gate
(`review`/`refactor` mechanics). Reach for `fix` when the goal is to _land_ the
findings as a clean patch series, not to get a PASS/FAIL verdict.

The engine that every command reuses is documented separately and is **not** a
user-facing command: [reference/engine.md](reference/engine.md) (qoq CLI
discovery, the `qoq --check --json` run, and the compact digest from
`scripts/summarize.mjs`). The shared analysis worker the commands fan out to is
[agents/qoq-analyzer.md](agents/qoq-analyzer.md).

### Routing rules

1. **No argument**: render the commands table above as a menu and ask what the
   user would like to do.
2. **First word matches a command** (`review`, `refactor`, `fix`, `bump`, `gate`):
   load its reference file and follow it. Everything after the command name is the
   target (e.g. `refactor packages/cli/src`; `fix src/foo.ts`; `gate
src/foo.test.ts src/foo.ts`; `bump packages` → command `bump`, the word
   `packages` is just confirming the noun). Setup has already run, so the command
   reference picks up from its own first phase without re-doing the engine handoff.
3. **First word doesn't match**: infer the closest command from the request —
   "is this ready to merge?" → `review`; "clean up the auth module" →
   `refactor`; "fix the lint errors / findings" → `fix`;
   "our deps are stale" → `bump packages`; "check the code I just generated meets
   our standards" → `gate` — then load that reference. Disambiguating `fix` from its
   neighbors: `fix` lands findings as approved patches over the full project (or a
   chosen scope), running `qoq --check`; `gate` wants a non-interactive PASS/FAIL
   verdict over a producer's just-changed files; `review` wants a branch reviewed
   against a base; `refactor` improves a chosen area with no findings yet in hand.

The command reference owns its own phases (scoping, analysis, presentation,
execution, cleanup); this file owns only the shared setup, principles, and
routing.

## Consuming `/qoq` from another skill

`/qoq` is meant to be a **reusable quality gate that other skills fall back to**
before they declare a task done. A producer skill — one that generates tests,
scaffolds a feature, writes a migration, applies a codegen step — should not call
itself finished until what it produced meets the project's QoQ standards. Rather
than each skill re-implementing "run the linters, fix the findings, refactor the
rough edges", it delegates that last mile to the `gate` command here.

**The contract.** A producer invokes the gate over the files it just changed and
treats the verdict as a release gate:

- **Invocation** — run the `gate` command (`/qoq gate <paths…>`, or read
  [reference/gate.md](reference/gate.md) and follow it) passing the explicit list
  of files the producer created or edited. With no paths, `gate` infers its scope
  from the working tree (`git status` + `git diff`).
- **What it does** — autonomously brings that scope up to standard: auto-applies
  the safe fixes (formatting, naming, conventions, clear complexity wins) behind
  the project's own `qoq --check` + test/build gate, and lists the
  judgment-heavy findings (dead-code deletion, de-duplication, pattern changes)
  as advisories instead of forcing them.
- **What it returns** — a structured verdict: `QoQ GATE — PASS` or `FAIL`, the
  fixes applied, the advisories left, and the validation result. **`PASS`** means
  the scope meets the standards and validation is green; **`FAIL`** means
  validation could not be made green or a hard standard is violated and couldn't
  be auto-fixed.
- **How the producer reacts** — on `PASS`, declare done (surface any advisories to
  the user). On `FAIL`, do **not** declare done: address the reported blockers (or
  hand them back to the user) and re-gate.

**Definition-of-done snippet** — a producer skill adds a final step like this so
the fallback is explicit:

> **Before declaring done:** run `/qoq gate <the files you changed>` and wait for
> its verdict. If it returns `FAIL`, fix the reported blockers and re-run it. Only
> declare the task complete on `PASS`; pass along any advisories it reported.

This keeps one definition of "quality" — `review`'s seven dimensions and the
engine — and lets every other skill borrow it without duplicating any of it.
