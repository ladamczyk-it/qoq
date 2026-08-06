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
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
  - WebFetch
  - WebSearch
  - Bash(npm run:*)
  - Bash(npm outdated:*)
  - Bash(npm i:*)
  - Bash(npm install:*)
  - Bash(qoq:*)
  - Bash(npx qoq:*)
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
metadata:
  version: 1.4.0
---

Applies the QoQ — _quality over quantity_ — standard to a JS/TS codebase: a few
high-confidence, intention-revealing changes over a long list of nitpicks. Every
suggestion is staged as a reviewable git patch and applied one at a time behind
the project's own lint/test/build gate.

## Setup

Three things are true for **every** command, so establish them before routing
into one.

1. **Confirm a clean working tree** — unless the caller asked for `--tree
dirty`. Run `git status`. Most commands edit files and revert them as their
   safety net, so a dirty tree gets tangled in that. If there are uncommitted
   changes, point them out and ask the user to commit, stash, or confirm
   stashing is fine before continuing. `gate` and `fix` never ask: they lean on
   the snapshot instead ([references/workflow.md](references/workflow.md#the-safety-snapshot)).
   Any command can be put in that mode deliberately — see
   [Run modes](references/workflow.md#run-modes--tree-and-decisions).

2. **Locate the QoQ engine.** The linters and formatters (Prettier, ESLint,
   Knip, JSCPD, Stylelint, Structurelint) and their `--json` digest are owned by
   one place — [references/engine.md](references/engine.md). Work out how `qoq` is
   invoked in this project (a `qoq:check` / `qoq:fix` npm script, `npx qoq`, or
   a build-first monorepo) and read its config, exactly as that file describes.
   Every command defers to the engine rather than re-deriving flags or parsing
   raw reports. If a project has no `qoq` set up at all, the engine documents
   the fallback to the project's own ESLint/Knip/JSCPD/Prettier scripts.

3. **Pick a run id.** Every command works inside its own
   `.qoq/runs/<run-id>/` directory, passed to the bundled scripts as
   `--run <id>` ([workflow.md](references/workflow.md#the-workspace--qoq)).
   Use the caller's natural identifier when there is one — a plan executor's
   ticket id (`--run 2.3`) is ideal — and `default` for an ordinary
   human-driven run. The id is what keeps two agents gating different files in
   the same repo from deleting each other's restore points, so a caller that
   might be running beside another one must pass a distinct one.

Skipping these produces output that fights the project's own tools or corrupts
the patch workflow's safety net.

## Shared machinery

Three files own everything the commands have in common; the command references
link to them instead of restating them:

- **[references/workflow.md](references/workflow.md)** — the two run modes
  (`tree`, `decisions`) that let any command run unattended, plus the `.qoq/`
  workspace, the safety snapshot, validation-command discovery, staging and
  applying patches, cleanup. Backed by two bundled scripts
  (`scripts/workspace.mjs`, `scripts/stage-patch.mjs`) — use them rather than
  re-implementing the procedures by hand.
- **[references/analysis.md](references/analysis.md)** — the seven quality
  dimensions (`review`/`refactor` source one of the seven, design patterns,
  from an external lens instead — see below) and the keep-vs-drop bar. The
  per-tool fix strategy and false-positive pitfalls live in
  [references/tool-playbook.md](references/tool-playbook.md).
- **[references/engine.md](references/engine.md)** — qoq CLI discovery, the
  `qoq --check --json` run, and the compact digest from
  `scripts/summarize.mjs`.

The shared analysis worker the commands fan out to is
[agents/qoq-analyzer.md](agents/qoq-analyzer.md), dispatched as
`subagent_type: qoq-analyzer`. It ships registered with the plugin; if it isn't
in your available agent types, spawn a `general-purpose` subagent pointed at
that file instead.

## External skill dependencies (`review`, `refactor` only)

`review` and `refactor` delegate the design-patterns dimension to a
third-party skill instead of reasoning about it in-house, and add a new
minimalism/over-engineering lens on top (never part of the seven dimensions)
— `fix` and `gate` use neither and are unaffected. Full mechanism, tiering,
and missing-skill handling: [references/delegation.md](references/delegation.md).

- **`ponytail-review`** (ponytail family) — the minimalism/over-engineering
  lens.
- **`design-pattern-review`** (`sirius-zuo/design-pattern-skill`, code-review
  mode) — the design-pattern/architecture lens.

Neither is a hard requirement: if one isn't installed, `review`/`refactor`
tell the user, offer to install it, and otherwise degrade gracefully to
whichever lens(es) remain plus the unaffected internal dimensions. Each lens
also runs on its own model tier, not the orchestrator's — see
[Model tiering](references/delegation.md#model-tiering) for which tier and
why.

Two principles hold everywhere:

- **Plan, then execute.** Stage every change as a patch without touching the
  working tree, get sign-off, then apply one patch at a time behind the
  validation gate. An empty result is a fine result — recommend dropping
  valid-but-low-value patches.
- **Stop at decision points** — these commands mutate a real repo — but if the
  user already stated preferences (base branch, scope, excluded packages,
  whether subagents are allowed, whether to auto-apply, whether to proceed
  without a missing lens — [delegation.md](references/delegation.md#checking-availability-first)),
  honor them and don't re-ask. That last one matters in practice: on a project
  without `ponytail-review` / `design-pattern-review` installed, every
  `review`/`refactor` call hits the same missing-lens prompt — once the user
  has answered it for this conversation, treat later calls in the same
  conversation as already answered instead of asking again per-command.
  **`decisions: auto` is the deliberate exception:** the run completes without
  interactive approval, auto-applying only safe fixes and reporting judgment
  calls as advisories. `gate` is pinned there; any command can be sent there by
  a caller that has no human to ask.

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

| Aspect          | `review`             | `refactor`         | `fix`                                        | `gate`                                     |
| --------------- | -------------------- | ------------------ | -------------------------------------------- | ------------------------------------------ |
| Scope           | branch vs. base diff | a scope you choose | full project (or named scope), `qoq --check` | producer's just-changed files (dirty tree) |
| `tree` default  | `clean`              | `clean`            | `dirty`                                      | `dirty` (pinned)                           |
| Findings        | staged as patches    | staged as patches  | **both tiers** staged as patches             | safe tier auto-applied, rest = advisories  |
| `decisions` def | `human`              | `human`            | `human`                                      | `auto` (pinned)                            |
| Output          | applied patches      | applied patches    | patch series (+ optional verdict)            | structured `PASS`/`FAIL` verdict           |

The `tree` and `decisions` columns are **defaults, not fixed properties** —
`review` and `refactor` both accept `--tree dirty` and `--decisions auto`, which
is how a non-human caller gets refactor-grade analysis without a sign-off step.
The mode contract is [Run modes](references/workflow.md#run-modes--tree-and-decisions);
what stays true in every mode is the risk-tier boundary and the scope bound.

**`fix`'s non-interactive shortcut vs. `gate`.** Told to run unattended, `fix`
starts to look like `gate` — safe tier applied, advisory tier left behind —
but their default scopes still differ: `fix` with nothing named defaults to
the **whole project**; `gate` with no explicit paths defaults to **whatever's
currently dirty**. That default is the trap in each direction:

- "check what I just wrote" → reach for `gate`; reaching for `fix` here
  re-analyzes the whole project, far more than intended.
- "land the findings across the repo" → reach for `fix`; reaching for `gate`
  here silently limits the run to only the dirty tree.

When the request wants an unattended run, pass an explicit scope either way —
that neutralizes the default-scope trap — then pick by what should happen to
the advisory tier: `gate` when the caller just wants a verdict and a report of
what needs a human; `fix` when the advisory tier should land as inspectable
patch files, not just prose.

### Routing rules

1. **No argument**: render the commands table above as a menu and ask what the
   user would like to do.
2. **First word matches a command** (`review`, `refactor`, `fix`, `bump`,
   `gate`): load its reference file and follow it. Everything after the command
   name is the target (examples: `refactor packages/cli/src`; `fix src/foo.ts`;
   `gate src/foo.test.ts src/foo.ts`; `bump packages` → command `bump`, the
   word `packages` just confirms the noun). Setup has already run, so the
   command reference picks up from its own first phase.

   `--tree clean|dirty`, `--decisions human|auto`, and `--run <id>` are modes,
   not targets — strip them from the argument before resolving the scope, and
   apply the first two per
   [Run modes](references/workflow.md#run-modes--tree-and-decisions). A caller
   describing the same thing in prose ("run it over these files without asking
   me") means the same modes; honor it rather than requiring the flags.

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
  list of files the producer created or edited — always do this when the list
  is known, since a producer almost always knows exactly which files it just
  touched. Without paths, `gate` infers its scope from the whole dirty tree,
  which also catches any unrelated uncommitted work sitting there and applies
  safe-tier fixes to it with no approval step; that fallback is for callers
  that genuinely don't know their own file list, not a convenience default.
  For example:

  ```
  /qoq gate src/generated/UserApi.ts src/generated/UserApi.spec.ts
  ```

  **A producer that might be running beside other producers adds `--run
<id>`** — its ticket id, its task name, anything unique to it:

  ```
  /qoq gate src/audit/audit.controller.ts --run 2.3
  ```

  Without it every concurrent caller shares the `default` workspace, and the
  first one to finish deletes the snapshots the others still need to roll back
  a bad fix. One flag, and the runs can't touch each other.

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

### Going past the gate — unattended `review` / `refactor`

`gate` is a floor: safe fixes applied, everything else reported. A producer
that wants the **wider lens** — the minimalism and design-pattern reviews that
only `review`/`refactor` run — doesn't need a second gate-shaped command. It
runs the real one in the modes that suit a caller with no human attached:

```
/qoq refactor <the files you changed> --tree dirty --decisions auto
```

`--tree dirty` is what makes this usable _before_ the producer commits, which
is the only moment the analysis can still change what lands;
`--decisions auto` drops the sign-off pause while keeping the risk-tier
boundary and the scope bound exactly where they are. Full contract:
[Run modes](references/workflow.md#run-modes--tree-and-decisions).

Same shape for a diff instead of a file list: `/qoq review --tree dirty
--decisions auto`.

**How the producer reacts.** The safe tier has already been applied to its
working tree, so the code it's about to hand over is not quite the code it
wrote — re-run whatever it validates with, and read the advisory tier rather
than dropping it. A caller that can't act on advisories itself passes them up;
that's what keeps an unattended run honest about what it chose not to touch.

Order matters when a producer uses both: **refactor first, gate second.**
Refactor can change the files, and the gate's verdict should describe what
actually lands.
