---
sidebar_position: 2
title: qoq-fullstack
description: A chief of staff for one feature that spans several repos — a business-only BRD, one qoq plan per repo, and every repo's plan delivered in parallel.
---

# qoq-fullstack

A second Claude Code plugin in the `qoq-agent-skills` marketplace, new in v7.1.0. It coordinates **one feature across several repos** — an API and a UI, two APIs and a front end, any set of [qoq](./qoq/index.md)-based JavaScript/TypeScript repos in one parent folder. Installing it also installs `qoq`:

```text
/plugin install qoq-fullstack@qoq-agent-skills
```

This thread is the **chief of staff**. It owns a business-level master plan (the BRD), starts one background Claude session per repo, relays their questions to you, and unblocks work across repos. It never writes code, never plans a repo, and never decides anything technical — a technical decision made here would bind a repo whose conventions this thread hasn't read. Each repo session runs the ordinary `qoq plan` and `qoq execute` on its own code.

| Invocation                           | Does                                                 |
| ------------------------------------ | ---------------------------------------------------- |
| `/qoq-fullstack plan <requirements>` | business grilling → BRD → one plan per repo, relayed |
| `/qoq-fullstack execute <slug>`      | every repo's plan in parallel, gated per master      |
| `/qoq-fullstack status [<slug>]`     | read-only; one script call, so it needs no model     |

## The files are the state

The parent folder holds the repos plus the chief of staff's own files:

```text
<project>/
  feature.json                 # the repos — written once, reused by every feature
  feature/<slug>/brd.md        # one per feature: the master plan
  contracts/<name>.md          # written by the providing repo's session
  <repo>/  <repo>/  …          # independent git repos, each with its own plans/
```

`feature.json` lists every repo (`name`, `path`, `role`, optional `after`), the named `integration` checks (each an `npm run <script>` in one repo) and the `permissionMode` and `model` repo sessions start in. `model` is chosen by you, once, because N repos run N sessions at the same time; `opus` is the recommendation. A `feature.json` written before the field existed has none, so the chief of staff asks once and writes your answer in before launching. Every sub-command starts by running `qoq`'s `scripts/feature-status.mjs`, and again after every message. It acts only on what the script returns, because a repo session writes its plan file before it sends a message — if a message and the file disagree, the file wins.

## `plan`

1. **Business grilling — business only.** Actors, what they can do, what they observe, where a milestone ends. A technology question is never asked: it is parked verbatim in the BRD, and the repo it lands in asks it against code this thread has never read.
2. **The BRD.** `feature/<slug>/brd.md` holds every requirement as a Given/When/Then scenario tagged with its master milestone, the master milestones with their **Depends on** and **Integration** check, and the parked questions. It is approved before any repo plans.
3. **A plan per repo**, in `after` order; repos with no `after` start together. Each repo decides from its own code whether anything lands in it — if not, it answers `no changes needed` and gets no plan and no session in `execute`. Approvals and "no changes needed" reach you through the relay: a repo can't approve its own plan.
4. **Schedule.** Repos run in parallel, so the order inside each decides how long the others wait. `scripts/schedule.mjs` simulates the run and reorders independent milestones so the piece another repo needs goes first. A hard dependency never moves, and no question is asked.
5. **Coverage.** Every master milestone needs at least one repo milestone serving it; a gap is raised with you.

The repo side of this protocol — the `Feature` header, the **Serves** column, `<repo>:M<N>` dependencies and contracts — is described under [`plan`](./qoq/plan.md#a-repos-share-of-a-feature).

## `execute`

A loop over the status script: wake every repo whose `next.runnable` is true with `/qoq execute <planDir>`, and run each master milestone's integration checks once every repo's working tree is clean. A pass is the only thing that marks the master milestone `delivered` and unblocks the next. A failure goes to you verbatim, and the fix goes back to a repo as a `qoq replan`. When a repo escalates, only the repos waiting on its milestone are stuck. When every master milestone is delivered, the feature is `complete`.

## Repo sessions

- One session per repo named `<project>-<repo>`, started with `claude --bg --model <model>` (`feature.json`'s `model`) in the repo's own folder, so it loads that repo's `CLAUDE.md`, `qoq.config` and agents.
- Every question a repo would ask goes to the chief of staff, and from there to you verbatim. Nothing technical is answered by the chief of staff.
- Each repo works on `feature/<slug>` in its own checkout — no worktrees, no branch switching.

Setup, once per repo, needs your say-so: `crossSessionInbound: "accept"` and `worktree.bgIsolation: "none"` in the repo's `.claude/settings.local.json`; Claude Code 2.1.236 or later; a trusted workspace; and the repo on `feature/<slug>` with a clean tree.
