---
name: qoq
description: >-
  QoQ "quality over quantity" toolkit for JavaScript/TypeScript projects:
  review a branch against its base, refactor a chosen scope, fix findings
  project-wide as reviewable git patches, bump npm dependencies in safe
  stages, or gate freshly produced code with a non-interactive PASS/FAIL
  verdict other skills call before declaring work done. Use whenever the user
  says "review my branch/PR", "ready to merge", "clean
  up/refactor/tidy/modernize", "reduce complexity", "remove dead deps",
  "de-duplicate", "fix naming/lint errors", "apply quality standards",
  "bump/update deps", or asks whether generated code meets project standards.
argument-hint: '[review|refactor|fix|bump packages|gate] [target]'
user-invocable: true
allowed-tools:
  - Task
  - WebFetch
  - WebSearch
  - Bash(npm run:*)
  - Bash(npm outdated:*)
  - Bash(npm i:*)
  - Bash(npm install:*)
  - Bash(qoq:*)
  - Bash(npx qoq:*)
  - Bash(npx knip:*)
  - Bash(npx jscpd:*)
  - Bash(npx eslint:*)
  - Bash(npx prettier:*)
  - Bash(node:*)
  - Bash(git diff:*)
  - Bash(git merge-base:*)
  - Bash(git symbolic-ref:*)
  - Bash(git apply:*)
  - Bash(git restore:*)
  - Bash(git checkout:*)
  - Bash(git stash:*)
  - Bash(git status:*)
  - Bash(git log:*)
  - Bash(git ls-files:*)
  - Bash(git cat-file:*)
  - Bash(gh release:*)
  - Bash(gh api:*)
  - Bash(ls:*)
  - Bash(rm -rf .qoq)
  - Bash(rm -f node_modules/@ladamczyk/qoq-cli/bin/.npm-outdated-lock)
  - Bash(rm -f packages/cli/bin/.npm-outdated-lock)
metadata:
  version: 1.3.0
---

Applies the QoQ — _quality over quantity_ — standard to a JS/TS codebase: a few
high-confidence, intention-revealing changes over a long list of nitpicks. Every
suggestion is staged as a reviewable git patch and applied one at a time behind
the project's own lint/test/build gate.

## Setup

Two things are true for **every** command, so establish them before routing into
one.

1. **Confirm a clean working tree.** Run `git status`. Most commands edit files
   and revert them as their safety net, so a dirty tree gets tangled in that. If
   there are uncommitted changes, point them out and ask the user to commit,
   stash, or confirm stashing is fine before continuing. **Exception: `gate` and
   `fix`** — both lean on a snapshot as their safety net instead of demanding a
   clean tree ([references/workflow.md](references/workflow.md#the-safety-snapshot)),
   and both tolerate uncommitted work.

2. **Locate the QoQ engine.** The linters and formatters (Prettier, ESLint,
   Knip, JSCPD, Stylelint, Structurelint) and their `--json` digest are owned by
   one place — [references/engine.md](references/engine.md). Work out how `qoq` is
   invoked in this project (a `qoq:check` / `qoq:fix` npm script, `npx qoq`, or
   a build-first monorepo) and read its config, exactly as that file describes.
   Every command defers to the engine rather than re-deriving flags or parsing
   raw reports. If a project has no `qoq` set up at all, the engine documents
   the fallback to the project's own ESLint/Knip/JSCPD/Prettier scripts.

Skipping these produces output that fights the project's own tools or corrupts
the patch workflow's safety net.

## Shared machinery

Three files own everything the commands have in common; the command references
link to them instead of restating them:

- **[references/workflow.md](references/workflow.md)** — the `.qoq/` workspace,
  the safety snapshot, validation-command discovery, staging and applying
  patches, cleanup. Backed by two bundled scripts (`scripts/workspace.mjs`,
  `scripts/stage-patch.mjs`) — use them rather than re-implementing the
  procedures by hand.
- **[references/analysis.md](references/analysis.md)** — the seven quality
  dimensions every analyzing command runs, and the keep-vs-drop bar. The
  per-tool fix strategy and false-positive pitfalls live in
  [references/tool-playbook.md](references/tool-playbook.md).
- **[references/engine.md](references/engine.md)** — qoq CLI discovery, the
  `qoq --check --json` run, and the compact digest from
  `scripts/summarize.mjs`.

The shared analysis worker the commands fan out to is
[agents/qoq-analyzer.md](agents/qoq-analyzer.md) (register it under
`.claude/agents/` to dispatch it as `subagent_type: qoq-analyzer`; without
registration, spawn a `general-purpose` subagent pointed at that file).

Two principles hold everywhere:

- **Plan, then execute.** Stage every change as a patch without touching the
  working tree, get sign-off, then apply one patch at a time behind the
  validation gate. An empty result is a fine result — recommend dropping
  valid-but-low-value patches.
- **Stop at decision points** — these commands mutate a real repo — but if the
  user already stated preferences (base branch, scope, excluded packages,
  whether subagents are allowed, whether to auto-apply), honor them and don't
  re-ask. **`gate` is the deliberate exception:** it runs to completion without
  interactive approval, auto-applying only safe fixes and reporting judgment
  calls as advisories.

## Commands

| Command         | Description                                                                             | Reference                                        |
| --------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `review`        | Review a branch's changes against a base branch and stage fixes as patches              | [references/review.md](references/review.md)     |
| `refactor`      | Run the same analysis over a scope you choose (path/package/directory/whole project)    | [references/refactor.md](references/refactor.md) |
| `fix`           | Fix findings over the full project / chosen scope — stage both tiers as patches         | [references/fix.md](references/fix.md)           |
| `bump packages` | Safely update npm dependencies in stages — minor/patch first, then majors one at a time | [references/bump.md](references/bump.md)         |
| `gate`          | Non-interactive quality gate over a producer's just-written changes; returns PASS/FAIL  | [references/gate.md](references/gate.md)         |

When to use which command — how the four analyzing commands differ (this table
is the single owner of the comparison; the command references don't repeat it):

| Aspect       | `review`             | `refactor`         | `fix`                                        | `gate`                                     |
| ------------ | -------------------- | ------------------ | -------------------------------------------- | ------------------------------------------ |
| Scope        | branch vs. base diff | a scope you choose | full project (or named scope), `qoq --check` | producer's just-changed files (dirty tree) |
| Working tree | clean                | clean              | dirty tolerated via snapshot                 | expected dirty — the changes are the scope |
| Findings     | staged as patches    | staged as patches  | **both tiers** staged as patches             | safe tier auto-applied, rest = advisories  |
| Approval     | plan → sign-off      | plan → sign-off    | plan → sign-off (or non-interactive)         | none — runs to completion                  |
| Output       | applied patches      | applied patches    | patch series (+ optional verdict)            | structured `PASS`/`FAIL` verdict           |

### Routing rules

1. **No argument**: render the commands table above as a menu and ask what the
   user would like to do.
2. **First word matches a command** (`review`, `refactor`, `fix`, `bump`,
   `gate`): load its reference file and follow it. Everything after the command
   name is the target (examples: `refactor packages/cli/src`; `fix src/foo.ts`;
   `gate src/foo.test.ts src/foo.ts`; `bump packages` → command `bump`, the
   word `packages` just confirms the noun). Setup has already run, so the
   command reference picks up from its own first phase.
3. **First word doesn't match**: infer the closest command from the request —
   "is this ready to merge?" → `review`; "clean up the auth module" →
   `refactor`; "fix the lint errors / findings" → `fix`; "our deps are stale" →
   `bump packages`; "check the code I just generated meets our standards" →
   `gate` — then load that reference. When `fix` and its neighbors are hard to
   tell apart, the comparison table above disambiguates.

The command reference owns its own phases (scoping, analysis, presentation,
execution, cleanup); this file owns only the shared setup, principles, and
routing.

## Consuming `/qoq` from another skill

`/qoq` is meant to be a **reusable quality gate that other skills fall back to**
before they declare a task done. A producer skill — one that generates tests,
scaffolds a feature, writes a migration, applies a codegen step — should not
call itself finished until what it produced meets the project's QoQ standards.
Rather than each skill re-implementing "run the linters, fix the findings,
refactor the rough edges", it delegates that last mile to the `gate` command.

**The contract.** A producer invokes the gate over the files it just changed and
treats the verdict as a release gate:

- **Invocation** — run the `gate` command (`/qoq gate <paths…>`, or read
  [references/gate.md](references/gate.md) and follow it) passing the explicit
  list of files the producer created or edited. With no paths, `gate` infers
  its scope from the working tree. For example:

  ```
  /qoq gate src/generated/UserApi.ts src/generated/UserApi.spec.ts
  ```

- **What it does** — autonomously brings that scope up to standard: auto-applies
  the safe fixes behind the project's own `qoq --check` + test/build gate, and
  lists the judgment-heavy findings as advisories instead of forcing them.
- **What it returns** — a structured verdict: `QoQ GATE — PASS` or `FAIL`, the
  fixes applied, the advisories left, and the validation result.
- **How the producer reacts** — on `PASS`, declare done (surface any advisories
  to the user). On `FAIL`, do **not** declare done: address the reported
  blockers (or hand them back to the user) and re-gate.

**Definition-of-done snippet** — a producer skill adds a final step like this so
the fallback is explicit:

> **Before declaring done:** run `/qoq gate <the files you changed>` and wait
> for its verdict. If it returns `FAIL`, fix the reported blockers and re-run
> it. Only declare the task complete on `PASS`; pass along any advisories it
> reported.

This keeps one definition of "quality" — the seven dimensions and the engine —
and lets every other skill borrow it without duplicating any of it.
