---
name: qoq
description: Quality toolkit for JavaScript/TypeScript repos — `fix`, `refactor`, `bump`, `plan`, `execute`, `test`, `compress`. Use it whenever the user wants lint or formatting cleaned up, dead code or dead dependencies removed, a branch checked before merge, duplication refactored, npm dependencies bumped, a spec broken into tickets, an approved plan executed or resumed, tests written for code that already exists, or agent-facing markdown (CLAUDE.md, AGENTS.md, skill docs) made terser to stop burning context. Trigger it even when the user never says "qoq" or names a tool.
argument-hint: '[fix|refactor|bump|plan|execute|test|compress] [scope]'
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
  - Skill
  - AskUserQuestion
  - Bash(npm run:*)
  - Bash(npm test:*)
  - Bash(npm install:*)
  - Bash(npm ci:*)
  - Bash(npm outdated:*)
  - Bash(npx qoq:*)
  - Bash(node:*)
  - Bash(git status:*)
  - Bash(git ls-files:*)
  - Bash(git log:*)
  - Bash(git diff:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git checkout:*)
  - Bash(git branch:*)
  - Bash(git apply:*)
  - Bash(git restore:*)
  - Bash(git revert:*)
  - Bash(git symbolic-ref:*)
  - Bash(git merge-base:*)
---

# QoQ — quality over quantity

Seven commands, one shared discovery record, six agents.

**This file routes.** Each command's reference owns its rules — read the one you
need, not all of them.

| Command    | Does                                                       | Reference                                        |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------ |
| `fix`      | check/fix loop over tool findings, ends on PASS/FAIL       | [references/fix.md](references/fix.md)           |
| `refactor` | green base, then four judgement assessments over a scope   | [references/refactor.md](references/refactor.md) |
| `bump`     | analyse dependencies, pick, then apply one patch at a time | [references/bump.md](references/bump.md)         |
| `plan`     | requirements → an approved plan file under `./plans/`      | [references/plan.md](references/plan.md)         |
| `execute`  | an approved plan file → delivered milestones               | [references/execute.md](references/execute.md)   |
| `test`     | unit/integration coverage for code that already exists     | [references/test.md](references/test.md)         |
| `compress` | strip agent-facing markdown to what an agent acts on       | [references/compress.md](references/compress.md) |

Everything a command knows about the project comes from one cached record,
derived once per top-level run:
[references/discovery.md](references/discovery.md).

## Usage

**Scope is positional, everywhere.** One spelling across all seven commands, so
nobody has to remember which one took a flag.

| Invocation                                     | Scope                                                  |
| ---------------------------------------------- | ------------------------------------------------------ |
| `/qoq fix`                                     | `qoq.config`'s `srcPath`                               |
| `/qoq fix src/auth/token.ts`                   | those files only                                       |
| `/qoq refactor`                                | `qoq.config`'s `srcPath`                               |
| `/qoq refactor src/modules/npm`                | those paths only                                       |
| `/qoq refactor --decisions auto <paths>`       | unattended: apply the mechanical tier, advise the rest |
| `/qoq bump`                                    | every outdated dependency                              |
| `/qoq plan <requirements file or description>` | —                                                      |
| `/qoq execute [plans/<file>.md]`               | omitted → ask, unless exactly one plan is approved     |
| `/qoq execute <plan> --session-limit 60`       | stop before spending past 60% of the 5-hour limit      |
| `/qoq execute <plan> --weekly-limit 80`        | same for the 7-day limit; both default to 100          |
| `/qoq test <what to cover>`                    | —                                                      |
| `/qoq compress`                                | every `CLAUDE.md` and `AGENTS.md` git tracks           |
| `/qoq compress docs/ skills/qoq/references`    | those paths only                                       |

Three flags exist. `--decisions auto` is for the two callers that can't stop to
answer questions — `execute`'s milestone gate and `bump`
([references/refactor.md](references/refactor.md)). `--session-limit` and
`--weekly-limit` cap what a plan run may spend of the account's 5-hour and 7-day
limits; give neither and no usage check runs at all
([references/execute.md](references/execute.md)).

## Entry

1. **One call, at the head of every top-level run:**

   ```bash
   node <skill>/scripts/entry.mjs --project <root> --command <command>
   ```

   It runs the three head-of-run checks — the agents, the discovery record, the
   usage stats — and prints a section per check with what to do about each. Do
   what the sections say. Exit 3 stops the run before any work: the qoq CLI
   isn't installed, and every command's spine is that binary.

   Once per **top-level** run, keyed to the command the user typed. A command
   invoked from inside another inherits everything the outer run already
   established rather than re-checking — a `fix` dispatched from inside
   `refactor` is part of that refactor, not a second run.

2. **If it asks you to dispatch `qoq-discovery`**, hand over the payload it
   printed and branch on the one status word that comes back, nothing else:
   `fresh` / `verified` → carry on; `repaired <fields>` → carry on and report
   the fields at the end of the run; `blocked <question>` → ask the user, write
   the answer into the project's own docs, re-dispatch
   ([references/discovery.md](references/discovery.md) has the wording).

3. **No command given** → ask which one. Never guess.

4. **Run the command**, then close the run by reporting anything discovery
   repaired — one line per field, _after_ the real work, never before it.

## Who calls whom

Commands compose, but **only on the main thread**.

| Command    | Calls                  | Called by                                                     |
| ---------- | ---------------------- | ------------------------------------------------------------- |
| `fix`      | its own `qoq-checker`  | `refactor`, `execute`, `test`, `compress`                     |
| `refactor` | `fix`                  | `bump`, `execute`, `test`                                     |
| `bump`     | `refactor` (per patch) | —                                                             |
| `plan`     | —                      | —                                                             |
| `execute`  | `fix`, `refactor`      | `plan` — offered at approval, never dispatched from inside it |
| `test`     | `fix`, `refactor`      | —                                                             |
| `compress` | `fix`                  | nobody                                                        |

`compress` changes what future runs read, never what this one does, so no
command should be reaching for it mid-task.

`refactor`'s assessment 3 is `ponytail-review`, the one lens this skill doesn't
own — it looks the name up in its own available-skills list when it gets there,
because that list is already in the thread's context and is never out of date.
Assessment 4 is `qoq-designer`, which ships here.

## Standing rules

These hold in every command. Each command's reference assumes them rather than
restating them.

**Never assume a default.** Anything unclear is a question for the user, not a
sensible guess with a note afterwards — a guess that looks plausible is worse
than a stop, because nobody notices it. Subagents can't ask, so an agent on any
doubt **writes nothing and returns the question**: a half-written artifact is
indistinguishable from a stale one on the next run. The caller asks and
re-dispatches with the answer.

**`npx` is for `qoq` and nothing else.** Every other command is the project's own
script, verbatim — `npm test`, `npm run build`, `npm run test:execute -- {file}`.
Never compose `npx vitest …` or `npx tsc …` out of a dependency spotted in
`package.json`: that invocation skips the project's config, flags, and setup
files, and it is plausible enough that nobody notices it was invented. A project
with no script for something is a project that has to be asked.

**Nothing runs in parallel.** Not tickets, not test slices, not assessments, not
patches. Every check that matters is an attribution question — "did _this_
change break it?" — which a second agent writing concurrently makes
unanswerable.

**An agent that reports never fixes.** `qoq-checker`, `qoq-bumper` and
`qoq-designer` return findings and edit nothing. An agent permitted to do both will quietly do both,
and the finding disappears into the diff instead of reaching the user.

**Never buy green.** No `.skip`, no loosened assertion, no narrowed ticket, no
weakened gate. If the bar can't be met, that's a report, not something to route
around.

**The qoq CLI belongs to `fix`.** Every other command and every agent gets its
verdict by **dispatching `qoq fix`** and reading the PASS/FAIL line; nobody
assembles `npx qoq …` for themselves. One owner keeps the flags, the scoping,
the report location, and the digest a single answer instead of six that drift.
The project's own scripts — `test`, `test:one`, `build` — are a different matter
and anyone may run them.

**Read the digest, never a raw report.** An ESLint or JSCPD report on a real
codebase runs to tens of thousands of lines and is almost all repetition;
`scripts/summarize.mjs` collapses it. Open a raw report only when one specific
finding needs a line number, and read only that slice.

### The gate runs one thread up

A subagent composes nothing: it cannot dispatch another subagent. So
`qoq-developer` and `qoq-tester` can neither run `qoq fix` nor be allowed to
reach around it into the CLI, which belongs to `fix`. They write, verify with the
_project's own_ scripts, and hand back the list of files they touched; the
command that dispatched them runs `qoq fix` over exactly that list and
re-dispatches on a FAIL, with the digest pasted in. Same gate, same scope, one
thread up — and the retry budget moves with it, so an attempt is one
dispatch-and-gate round rather than a loop inside the agent.

## Agents

Six, in `agents/`. Everything is pinned except `qoq-developer`, whose tier is a
property of the ticket and is passed at dispatch.

| Agent           | Model      | Job                                                      |
| --------------- | ---------- | -------------------------------------------------------- |
| `qoq-discovery` | haiku      | derive/verify/repair the record — one per top-level run  |
| `qoq-checker`   | haiku      | run the tools, return the digest — one per `fix` loop    |
| `qoq-bumper`    | sonnet     | read a changelog, find what lands here — one per package |
| `qoq-developer` | _dispatch_ | one ticket, TDD — one per ticket                         |
| `qoq-tester`    | sonnet     | write the specs for one slice — one per slice            |
| `qoq-designer`  | sonnet     | stack → smells → patterns — `refactor`'s assessment 4    |

Entry copies them into the project's `.claude/agents/`, because an agent file
inside a skill is registered by nothing, and Claude Code picks that directory up
on its own a moment later. Whether a fresh install is a question for the user or
a line in the end-of-run notice depends on the command, and `entry.mjs` decides
it — do what its **agents** section says.

If an agent isn't registered under `.claude/agents/`, dispatch `general-purpose`
with the agent file's body pasted in, **plus the tier and the prohibitions
restated** — `general-purpose` inherits the session's model and gets every tool,
so an unregistered `qoq-checker` runs at the caller's tier and an unregistered
`qoq-tester` gains exactly the ability to edit production source its contract
forbids.

An agent reported as `kept (edited here)` is the user's own version and stays
that way. Dispatch it like any other; it's registered.

## Test conventions

[references/test-conventions.md](references/test-conventions.md) holds the house
rules for writing specs. Whoever writes a test in this project reads it rather
than reinventing a style. Where it conflicts with the project's own file — named
on the record's `conventions` field — **the project's file wins**: it's
human-written and knows things this skill can't infer.
