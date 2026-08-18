---
name: qoq
description: Quality toolkit for JavaScript/TypeScript repos — seven commands over one shared project discovery: `fix` (Prettier/ESLint/Knip/JSCPD findings to a PASS/FAIL verdict), `refactor`, `bump`, `plan`, `execute`, `test`, `compress`. Use it whenever the user wants lint or formatting cleaned up, dead code or dead dependencies removed, a branch checked before merge, duplication refactored, npm dependencies bumped, a spec broken into tickets, an approved plan executed or resumed, tests written for code that already exists, or agent-facing markdown (CLAUDE.md, AGENTS.md, skill docs) made terser to stop burning context. Trigger it even when the user never says "qoq" or names a tool.
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
| `/qoq test <what to cover>`                    | —                                                      |
| `/qoq compress`                                | every `CLAUDE.md` and `AGENTS.md` git tracks           |
| `/qoq compress docs/ skills/qoq/references`    | those paths only                                       |

`--decisions auto` is the only flag, and it exists for the two callers that
can't stop to answer questions: `execute`'s milestone gate and `bump`. Details
in [references/refactor.md](references/refactor.md).

## Entry

1. **Discovery** — every command except `compress`, which edits prose, runs no
   tool, and skips to step 2 because no line of the record bears on it.

   ```bash
   node <skill>/scripts/discovery-check.mjs --project <root>
   ```

   | Exit | Means                                                        | Do                               |
   | ---- | ------------------------------------------------------------ | -------------------------------- |
   | 0    | current — the record is on stdout                            | use it, dispatch nothing         |
   | 1    | missing or stale — stdout is the hash the new record carries | dispatch `qoq-discovery` with it |

   The dispatch carries the project root, that hash, and **the resolved `skills`
   field** — the one input the agent cannot derive, because the available-skills
   list is in your context and not in its. Look `ponytail-review` up in that
   list, **project scope before plugin scope**: a bare `ponytail-review` wins
   over `ponytail:ponytail-review`, and the winning name is what you hand in,
   because the recorded name _is_ the invocation. In neither scope is `null`.

   Branch on the one status word it returns and nothing else: `fresh` /
   `verified` → carry on; `repaired <fields>` → carry on and report the fields
   at the end of the run; `blocked <question>` → ask the user, write the answer
   into the project's own docs, re-dispatch
   ([references/discovery.md](references/discovery.md) has the wording).

   Once per **top-level** run — a command invoked from inside another inherits
   the record rather than re-dispatching. The hash covers only files on disk, so
   an installed or moved lens leaves a stale `skills` field this step can't see;
   `references/discovery.md` has what the hash covers and what to tell the user
   when that bites.

2. **Usage stats** — one call, before the work starts, once per top-level run:

   ```bash
   node <skill>/scripts/stats.mjs <command>                    # 0 handled, 1 not asked yet
   node <skill>/scripts/stats.mjs <command> --consent yes|no
   ```

   Exit 1 means nobody has been asked — ask with `AskUserQuestion`, then record
   the answer. The script owns where consent lives and whether it was already
   given, because both ways of getting that wrong — re-asking someone who
   declined, sending for them — leave nothing in the transcript to notice.

   Put the question honestly, on the facts. Each run posts two things to
   `https://stats.adamczyk.ovh`: the literal tool name `"qoq-skill"`, and which
   of the seven commands ran, e.g. `["fix"]`. Never sent: their code, file
   names, paths, config contents, tool findings, project or package names, scope
   arguments, plan contents, or anything identifying them or their machine.

   Keyed to the command the user typed: a `fix` dispatched from inside
   `refactor` is part of that refactor, not a second run.

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

`refactor`'s assessment 3 invokes `ponytail-review` under the exact name the
record's `skills` field carries. That name _is_ the invocation, and the bare and
prefixed forms do not resolve interchangeably. Assessment 4 is `qoq-designer`,
which ships with this skill and needs no lookup.

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

Discovery installs them into the project's `.claude/agents/` on its way past
(`scripts/sync-agents.mjs`), because an agent file inside a skill is registered
by nothing. Claude Code picks that directory up on its own a moment later, so the
dispatches right after a first install are the fallback below and the ones after
that aren't. Ahead of `fix`, `test` and `execute` — the three that dispatch
inside that window — discovery's report of an install is a question for the user
(carry on, or exit and re-run with them registered); elsewhere it's a line in the
end-of-run notice.

If an agent isn't registered under `.claude/agents/`, dispatch `general-purpose`
with the agent file's body pasted in, **plus the tier and the prohibitions
restated** — `general-purpose` inherits the session's model and gets every tool,
so an unregistered `qoq-checker` runs at the caller's tier and an unregistered
`qoq-tester` gains exactly the ability to edit production source its contract
forbids.

## Test conventions

[references/test-conventions.md](references/test-conventions.md) holds the house
rules for writing specs. Whoever writes a test in this project reads it rather
than reinventing a style. Where it conflicts with the project's own file — named
on the record's `conventions` field — **the project's file wins**: it's
human-written and knows things this skill can't infer.
