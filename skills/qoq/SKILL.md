---
name: qoq
description: QoQ "quality over quantity" toolkit for JavaScript/TypeScript projects — seven commands over one shared project discovery: `fix` (Prettier/ESLint/Knip/JSCPD findings to a PASS/FAIL verdict), `refactor`, `bump`, `plan`, `execute`, `test`, and `compress` (strips agent-facing markdown to what an agent acts on). Use it whenever the user says "is this ready to merge", "fix the lint errors", "clean up / refactor / de-duplicate this", "remove dead code or dead deps", "bump the dependencies", "break this spec into tickets", "what's the implementation plan for X", "execute the plan" or "resume ./plans/<file>", "write tests for this" — and for `compress`, "my CLAUDE.md is too long", "trim/shrink/tighten the agent docs", "this doc is burning context", "strip the prose out of X.md", "reduce token usage in the instructions", or any ask to make markdown terser for an LLM to read. Trigger it even when the user never says "qoq" or names a tool.
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

Seven commands, one discovery, five agents. Everything a command needs to know
about the project comes from one cached **record** derived once per top-level run.

**Read only what you need.** This file routes; each command's reference owns its
rules. Read the one you need, not all of them.

| Command    | Does                                                       | Reference                                        |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------ |
| `fix`      | check/fix loop over tool findings, ends on PASS/FAIL       | [references/fix.md](references/fix.md)           |
| `refactor` | green base, then four judgement assessments over a scope   | [references/refactor.md](references/refactor.md) |
| `bump`     | analyse dependencies, pick, then apply one patch at a time | [references/bump.md](references/bump.md)         |
| `plan`     | requirements → an approved plan file under `./plans/`      | [references/plan.md](references/plan.md)         |
| `execute`  | an approved plan file → delivered milestones               | [references/execute.md](references/execute.md)   |
| `test`     | unit/integration coverage for code that already exists     | [references/test.md](references/test.md)         |
| `compress` | strip agent-facing markdown to what an agent acts on       | [references/compress.md](references/compress.md) |

Discovery is shared and runs first, every time — except for `compress`, which
edits prose and runs no tool, so no line of the record bears on it:
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

0. **`compress` skips straight to step 4** — it dispatches no discovery, because
   nothing on the record describes a markdown file. Every other command goes
   through step 1.
1. **Dispatch `qoq-discovery`** with the project root and the resolved `skills:`
   line — look `ponytail-review` and `design-pattern-review` up in your own
   available-skills list and hand in the verdicts under the exact names it gives
   them, plugin prefix and all. That list is in your context and not the agent's
   — the one input it can't derive. Left to guess, it searches the filesystem,
   misses every plugin lens, and `refactor` drops an assessment with nothing in
   the output to say it did. Everything else it works out itself. Branch on
   the one status word it returns — `fresh` / `verified` / `repaired <fields>` /
   `blocked <question>` — and nothing else. Once per top-level run: a command
   invoked from inside another inherits the record rather than re-dispatching.
2. **`blocked`** → ask the user, write the answer into the project's own docs, and
   re-dispatch. Details in [references/discovery.md](references/discovery.md).
3. **No command given** → ask which one. `/qoq` on its own has seven plausible
   readings and guessing one is the failure mode the standing rules exist to
   prevent.
4. **Usage stats** — one call, before the work starts, once per top-level run:

   ```bash
   node <skill>/scripts/stats.mjs <command>
   ```

   Exit 0 ends it: consent was on record and the script already acted on it.
   Exit 1 means nobody has been asked yet — ask with `AskUserQuestion`, then
   record the answer:

   ```bash
   node <skill>/scripts/stats.mjs <command> --consent yes|no
   ```

   Put the question honestly, because the point of asking is that the user
   decides on the facts. Each run posts two things to
   `https://stats.adamczyk.ovh`: the tool name, always the literal
   `"qoq-skill"`, and the command that ran, one of the seven, e.g. `["fix"]`.
   Never sent: their code, file names, paths, config contents, tool findings,
   project or package names, scope arguments, plan contents, and nothing
   identifying them or their machine. A decline is recorded and never re-asked.

   The script resolves consent itself — the project's `qoq.config.*` first, the
   same `stats:` key the CLI writes, then `~/.claude/qoq/consent.md` — because
   both ways of getting it wrong, re-asking someone who declined and sending for
   them, leave nothing in the transcript to notice.

   Keyed to the command the user typed: a `fix` dispatched from inside
   `refactor` is part of that refactor, not a second run, so it doesn't call
   this again.

5. **Run the command**, then close the run by reporting anything discovery
   repaired — one line per field, _after_ the real work, never before it.

## Who calls whom

Commands compose, but **only on the main thread**.

- `fix` ← `refactor` (green base and re-green), `execute` (the per-ticket gate,
  after its developer hands back), `test` (the per-slice gate, after its writer
  hands back)
- `refactor` ← `bump` (per patch), `execute` (milestone gate), `test` (final tidy)
- `execute` ← `plan`, offered at approval and never dispatched from inside it
- `fix` ← `compress` (the Prettier pass over the markdown it rewrote)
- `fix` calls nothing but its own checker agent
- `compress` is called by nobody. It changes what future runs read, never what
  this one does, so no command should be reaching for it mid-task.

### The gate runs one thread up

A subagent composes nothing: it cannot dispatch another subagent. So
`qoq-developer` and `qoq-tester` can neither run `qoq fix` nor be allowed to
reach around it into the CLI, which belongs to `fix`. They write, verify with the
_project's own_ scripts, and hand back the list of files they touched; the
command that dispatched them runs `qoq fix` over exactly that list and
re-dispatches on a FAIL, with the digest pasted in. Same gate, same scope, one
thread up — and the retry budget moves with it, so an attempt is one
dispatch-and-gate round rather than a loop inside the agent.

The two external review lenses — `ponytail-review` and `design-pattern-review` —
are called only by `refactor`'s assessments 3 and 4, under the exact names the
available-skills list gives them (a plugin skill carries a `plugin:skill`
prefix, and the bare name won't resolve).

## Standing rules

These hold in every command. Each command's reference assumes them rather than
restating them.

**Never assume a default.** Anything unclear is a question for the user, not a
sensible guess with a note afterwards. A guess that looks plausible is worse than
a stop, because nobody notices it. Subagents can't ask, so an agent on any doubt
**writes nothing and returns the question** — a half-written artifact is
indistinguishable from a stale one on the next run. The caller asks and
re-dispatches with the answer.

**`npx` is for `qoq` and nothing else.** Every other command is the project's own
script, verbatim — `npm test`, `npm run build`, `npm run test:execute -- {file}`.
Never compose `npx vitest …` or `npx tsc …` out of a dependency spotted in
`package.json`: that invocation skips the project's config, flags, and setup
files, and it is plausible enough that nobody notices it was invented. A project
with no script for something is a project that has to be asked.

**Nothing runs in parallel.** Not tickets, not test slices, not assessments, not
patches. Everything here shares one working tree, and every check that matters is
an attribution question — "did _this_ change break it?" — which a second agent
writing concurrently makes unanswerable. Sequential also means each step starts
from a tree the previous one left green.

**An agent that reports never fixes.** `qoq-checker` and `qoq-bumper` return
findings and edit nothing. An agent permitted to do both will quietly do both,
and the finding disappears into the diff instead of reaching the user.

**Never buy green.** No `.skip`, no loosened assertion, no narrowed ticket, no
weakened gate. If the bar can't be met, that's a report, not something to route
around.

**The qoq CLI belongs to `fix` and to nothing else.** `fix` runs it, through its
own `qoq-checker`. Every other command and every agent gets its verdict by
**dispatching `qoq fix`** and reading the PASS/FAIL line; nobody assembles `npx
qoq …` for themselves. One command owning the invocation keeps the flags, the
scoping, the report location, and the digest a single answer instead of six that
drift. The project's own scripts — `test`, `test:one`, `build` — are a different
matter and anyone may run them.

**Read the digest, not the raw reports.** An ESLint or JSCPD report on a real
codebase runs to tens of thousands of lines and is almost all repetition. So
`qoq-checker`'s whole job is three commands, two of them scripts in this skill:

```bash
node <skill>/scripts/reports-current.mjs <report dir> <scope>   # 0 reuse, 1 re-run
<run:> <check:>                # both from the record; --json is what writes the reports at all
node <skill>/scripts/summarize.mjs <report dir>
```

A subagent can't guess where this skill lives, and neither script defaults its
arguments, so the **dispatch hands in both script paths and the report
directory**. `--output` is never passed: the CLI's default is where reports land
(`bin/report` inside the CLI package), and that default _is_ the `<report dir>`
argument.

Open a raw report only when one specific finding needs a line number, and read
only that slice.

## The record

Every command starts from one file, written by `qoq-discovery`, and dying with
`npm install` — the right lifetime, since its answers are only valid for the
dependency tree currently installed:

```
node_modules/@ladamczyk/qoq-cli/bin/qoq-skill-discovery.md
```

```
run: npx qoq
check: --check --json
test: npm test
test:one: npm run test -- {file}
build: npm run build
runner: vitest
globals: yes
react: yes
conventions: ./testing-gate.md
skills: ponytail:ponytail-review=yes design-pattern-review=no
```

Every boolean is `yes`/`no` — one encoding in a file five agents parse by hand.
A full check is `<run:> <check:>`, the two lines concatenated. Answers the user
gave by hand live in the project's own docs instead, and outlive the record.

Which command needs which lines, what each one means, and how the record is
derived, verified, and repaired:
[references/discovery.md](references/discovery.md).

## Agents

Five, in `agents/`. Everything is pinned except `qoq-developer`, whose tier is a
property of the ticket and is passed at dispatch.

| Agent           | Model      | Job                                                      |
| --------------- | ---------- | -------------------------------------------------------- |
| `qoq-discovery` | haiku      | derive/verify/repair the record — one per top-level run  |
| `qoq-checker`   | haiku      | run the tools, return the digest — one per `fix` loop    |
| `qoq-bumper`    | sonnet     | read a changelog, find what lands here — one per package |
| `qoq-developer` | _dispatch_ | one ticket, TDD — one per ticket                         |
| `qoq-tester`    | sonnet     | write the specs for one slice — one per slice            |

If an agent isn't registered under `.claude/agents/`, dispatch `general-purpose`
with the agent file's body pasted in, **plus the tier and the prohibitions
restated** — `general-purpose` inherits the session's model and gets every tool,
so an unregistered `qoq-checker` runs at the caller's tier and an unregistered
`qoq-tester` gains exactly the ability to edit production source its contract
forbids.

## Test conventions

`references/test-conventions.md` holds the house rules for writing specs —
coverage philosophy, when to mock, React Testing Library and MSW conventions, and
the lint rules that make a spec clean by construction. Whoever writes a test in
this project reads it rather than reinventing a style. Where it conflicts with
the project's own `testing-gate.md` (named on the record's `conventions:` line),
**the project's file wins** — it's human-written and knows things this skill
can't infer.
