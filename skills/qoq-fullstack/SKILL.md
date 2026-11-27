---
name: qoq-fullstack
description: Chief of staff for one feature that spans several repos — an API and a UI, two APIs and a front end, any set of qoq-based JavaScript/TypeScript repos in one parent folder. `plan` grills the business side only into a Given/When/Then BRD with master milestones, then has each repo write its own `qoq plan` in its own background session; `execute` runs every repo's plan in parallel, one session per repo, unblocking a repo only when the milestone it depends on is delivered and each master milestone only when its integration check passes; `status` shows where the feature stands. Use it whenever the user wants a cross-repo or full-stack feature planned or delivered, a scrum of scrums, a master plan over several repos, or parallel per-repo plans coordinated — even if they never say "fullstack".
argument-hint: '[plan|execute|status] [requirements or slug] [--session-limit <pct>] [--weekly-limit <pct>]'
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Skill
  - AskUserQuestion
  - Bash(npm run:*)
  - Bash(git status:*)
  - Bash(git branch:*)
  - Bash(node:*)
  - Bash(claude --version:*)
  - Bash(claude --bg:*)
  - Bash(cd:*)
  - Bash(git switch:*)
  - Bash(git checkout -b:*)
---

# QoQ fullstack — a scrum of scrums

This thread is the **chief of staff**. It owns a business-level master plan
(the BRD) and does three things: it starts one Claude session per repo,
relays their questions to the user, and unblocks work across repos. Each repo
session runs the ordinary `qoq plan` and `qoq execute` on its own code, in its
own folder, under its own conventions.

The chief of staff never writes code, never plans a repo, and never decides
anything technical. A technical decision made here would bind a repo whose
conventions this thread hasn't read.

`<root>` is the parent folder that holds the repos, and this session's working
directory. **This thread is the user's own session, never a background one.**
A repo session's question is answered by the user typing in this thread, and
an answer that arrives from another session is not the user's. The shapes of `feature.json` and the BRD are in
[assets/feature-template.md](assets/feature-template.md).

| Invocation                                                                   | Does                                                 | Reference                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| `/qoq-fullstack plan <requirements>`                                         | business grilling → BRD → one plan per repo, relayed | [references/plan.md](references/plan.md)                       |
| `/qoq-fullstack execute <slug>`                                              | every repo's plan in parallel, gated per master      | [references/execute.md](references/execute.md)                 |
| `/qoq-fullstack execute <slug> --session-limit <pct> [--weekly-limit <pct>]` | same, with a spending limit on the whole run         | [references/execute.md](references/execute.md#spending-limits) |
| `/qoq-fullstack status [<slug>]`                                             | read-only                                            | [below](#status)                                               |

Invoked with: `$ARGUMENTS`. No sub-command given → ask which one.

**Flags.** `--session-limit <pct>` and `--weekly-limit <pct>` are the only
flags, and `execute` is the only sub-command that takes them. Refuse any other
flag, or either one on `plan` or `status`, before you start any session. A bad
flag sent to the repos would fail once per repo, in background sessions nobody
is watching.

## Entry

1. **`qoq` is required.** Is it in your own available-skills list? If not,
   **stop**: _`qoq-fullstack` runs `qoq` in every repo. Install it with
   `/plugin install qoq@qoq-agent-skills`, then run this again._
2. **The status script** is `qoq`'s, at
   `${CLAUDE_SKILL_DIR}/../qoq/scripts/feature-status.mjs`. `<status>` below
   means that path. If the file isn't there, stop with the same message as in step 1.
   This skill's own scripts, `${CLAUDE_SKILL_DIR}/scripts/status.mjs` and
   `schedule.mjs`, take the same `--root <root> --feature <slug>` and build on
   `qoq`'s rules, so all three always give the same answer.

## The files are the state

Run `node <status> --root <root> --feature <slug>`
at the start of every sub-command, and again after every message or idle
notice that arrives. **Act only on what it returns.** It reads `feature.json`,
the BRD and every repo's plan index from disk.

Never act on what this thread remembers. A message tells you to look, but only
the file says what happened. A repo session writes to its plan file before it
sends a message, so if a message and the file disagree, believe the file.

## Starting and waking repo sessions

One session per repo, named `<project>-<repo>` (e.g. `trackbook-be`):

```
cd <root>/<path> && claude --bg --model <model> --permission-mode <mode> --name <project>-<repo> "<launch prompt>"
```

`<mode>` is `feature.json`'s `permissionMode`, which the user chose when the
file was written. Never infer it from this session's own mode. A background session that hits a
permission prompt waits in a window nobody is watching.

`<model>` is `feature.json`'s `model`, chosen by the user with the same file;
`opus` is the recommendation. Inside its repo, a session is the lead that
makes the decisions: it plans, gates and escalates, and it dispatches each
ticket to a `qoq-developer` at the tier the plan rated. A tier name resolves
through the user's `ANTHROPIC_DEFAULT_*_MODEL`, like every `qoq` tier. A
`feature.json` written before the field existed has none: ask once, recommend
`opus`, write the answer in, then launch. Never infer it from this session's
model.

Each session starts in its own repo, so it loads that repo's CLAUDE.md,
`qoq.config`, discovery record and agents. Start a session only if `ListAgents`
doesn't already list one with that name. If it's listed, `SendMessage` the
instruction to it instead.

Every launch prompt and every instruction message contains:

1. **What to run.** A `/qoq` invocation, and nothing more specific than that.
   While a spending limit is armed, every `/qoq execute` carries both limit
   flags, restarts included.
2. **Who to report to, and when.** This session's name, and the rule: _write
   to your plan files first, then `SendMessage` the chief of staff a one-line
   summary after every ticket commit, every milestone gate and every stop.
   Nobody reads this session's final text, so a turn that ends without that
   message, on a question, a stop, a wait or another skill's report, is
   never seen._
3. **Where the work goes.** _Work on `feature/<slug>` in this checkout, and
   commit there as the plan says. Commits on that branch are part of the
   approved plan. Never create or enter a worktree, and never switch branches._
4. **Where questions go.** _Every question you would ask the user, including
   grilling rounds, approval and escalations, goes to the chief of staff with
   `SendMessage`. End your turn and wait for the answer._ A session running in
   the background has nobody to ask, so a question asked locally just sits
   there.

After each launch or instruction, `SendMessage` the session again with
`notify_when_idle` set. A session that stops without messaging still wakes you
up, but not reliably: the notice can fail to arrive, so `execute`'s heartbeat
is the backstop.

A question from a repo goes to the user **verbatim**, prefixed with the repo's
name. The answer goes back verbatim too. Never answer one yourself: a
technical answer from this thread is exactly the decision it doesn't own.

## Setup — once per repo

**Which repos.** `plan` starts every repo in `feature.json`, because only a repo
can tell from its own code whether a requirement lands in it. `execute` starts
only the repos whose **Repo plans** row is a plan directory: a `none` row means
no changes are needed there, so that repo gets no session, no setup and no
question.

Before the first session starts in a repo, check:

1. **Repo settings.** The repo's `.claude/settings.local.json` needs both of these:
   - `"crossSessionInbound": "accept"`. Without it, the messages you send are
     held for approval in a window nobody is watching. It accepts messages from
     any local session.
   - `"worktree": { "bgIsolation": "none" }`. Without it, a background session
     moves its edits into a git worktree on a branch of its own, so the plan
     files in the checkout never move and nothing here can see the work.
     Delivery is plain branching: one branch per repo, in its own checkout.

   Ask the user once per repo whether to add what's missing, and say what each
   setting does. Declined → that repo is a stop, because the run can't drive it.

2. **Claude Code version.** Run `claude --version`. Cross-session messaging needs
   2.1.224 or later, and `notify_when_idle` needs 2.1.236 or later. Below that → stop
   and name the version.
3. **Workspace trust.** `claude --bg` refuses a folder that was never trusted,
   and prints `Workspace not trusted`. Accepting trust is the user's act. If a
   launch prints that, ask the user to run `claude` once in that folder and
   accept the prompt, then retry. Don't edit the trust record yourself.
4. **Branch.** Every repo works on `feature/<slug>`, checked out in the repo's
   own checkout before its session starts, with no worktree. A repo that isn't on
   it, or has uncommitted changes, is asked about once, together with the other
   repos.

## Standing rules

- **Repos run in parallel, and nothing else does.** Each repo is its own git
  repo with one writer, so "did _this_ change break it?" never crosses between
  repos. Inside a repo, `qoq execute` still runs one ticket at a time.
- **Never assume a default.** Anything unclear is a question for the user.
  Every question a repo session relays goes to the user too, unanswered here.

## Status

Read-only. Run `node ${CLAUDE_SKILL_DIR}/scripts/status.mjs --root <root> --feature <slug>`
and print what it prints. With no slug, list `feature/*/` and ask which one.
