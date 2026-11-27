---
name: qoq
description: Guarded delivery loop and quality gate for JavaScript/TypeScript repos — `fix`, `refactor`, `bump`, `plan`, `replan`, `execute`, `test`, `compress`, `document`, `mermaid`, `sheriff`, `review`, `feedback`. Use it whenever the user wants lint or formatting cleaned up, dead code or dependencies removed, a branch checked before merge, duplication refactored, npm dependencies bumped or their vulnerabilities fixed, a spec broken into tickets, a stalled plan reshaped, an approved plan executed or resumed (from a plan file or a Jira, Linear or Trello milestone), tests written for existing code, CLAUDE.md, AGENTS.md or skill docs made terser, the why behind code written down as JSDoc and `./docs`, a Mermaid diagram drawn, a change checked for security problems a linter can't see, a delivery or pull request checked against its plan or description, or feedback about qoq sent to its maintainers. Trigger it even when the user never says "qoq" or names a tool.
argument-hint: '[fix|refactor|bump|plan|replan|execute|test|compress|document|mermaid|sheriff|review|feedback] [scope]'
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
  - Bash(npm install)
  - Bash(npm ci)
  - Bash(npm view:*)
  - Bash(npx qoq:*)
  - Bash(git clone:*)
  - Bash(node:*)
  - Bash(git status:*)
  - Bash(git ls-files:*)
  - Bash(git log:*)
  - Bash(git diff:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git branch:*)
  - Bash(git apply:*)
  - Bash(git revert:*)
  - Bash(git symbolic-ref:*)
  - Bash(git merge-base:*)
  - Bash(git fetch:*)
  - Bash(gh pr view:*)
  - Bash(gh repo clone:*)
  - Bash(gh issue view:*)
hooks:
  PreToolUse:
    - matcher: Bash
      hooks:
        - type: command
          # CLAUDE_PLUGIN_ROOT is the plugin root when installed as a plugin, and the
          # skill dir itself for a project skill (.claude/skills/qoq). Fails closed.
          command: |
            f="$CLAUDE_PLUGIN_ROOT/skills/qoq/scripts/npx-guard.mjs"; [ -f "$f" ] || f="$CLAUDE_PLUGIN_ROOT/scripts/npx-guard.mjs"
            node "$f" || exit 2
---

# QoQ — quality over quantity

Thirteen commands, one shared discovery record, eleven agents.

**This file routes.** Each command's reference owns its rules — read the one you
need, not all of them.

| Command    | Does                                                         | Reference                                        |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------ |
| `fix`      | check/fix loop over tool findings, ends on PASS/FAIL         | [references/fix.md](references/fix.md)           |
| `refactor` | green base, then four judgement assessments over a scope     | [references/refactor.md](references/refactor.md) |
| `bump`     | analyse dependencies, pick, then apply one patch at a time   | [references/bump.md](references/bump.md)         |
| `plan`     | requirements → an approved plan directory under `./plans/`   | [references/plan.md](references/plan.md)         |
| `replan`   | an existing plan, reshaped — delivered work stays frozen     | [references/replan.md](references/replan.md)     |
| `execute`  | an approved plan, local or imported → delivered milestones   | [references/execute.md](references/execute.md)   |
| `test`     | unit/integration coverage for code that already exists       | [references/test.md](references/test.md)         |
| `compress` | strip agent-facing markdown to what an agent acts on         | [references/compress.md](references/compress.md) |
| `document` | _experimental_ — the why, as JSDoc, agent-owned `./docs`     | [references/document.md](references/document.md) |
| `mermaid`  | a validated Mermaid chart — printed, or written to a doc     | [references/mermaid.md](references/mermaid.md)   |
| `sheriff`  | security judgment on a change — typed findings, remediated   | [references/sheriff.md](references/sheriff.md)   |
| `review`   | a delivery or PR judged against its intent — typed findings  | [references/review.md](references/review.md)     |
| `feedback` | what the user thinks of a command or agent → the maintainers | [references/feedback.md](references/feedback.md) |

Two files sit under every command rather than beside them. What this skill knows
about the _project_ is one cached record, derived once per top-level run:
[references/discovery.md](references/discovery.md). What it knows about the _qoq
binary_ — invocations, flags, report location, the digest scripts, and which
command or agent may run which — is
[references/cli.yaml](references/cli.yaml). Open either when you need it; this
file states neither, so there is one copy of each to go stale.

## Usage

**Scope is positional, everywhere.** One spelling across all thirteen commands, so
nobody has to remember which one took a flag. `mermaid`'s is a description,
not a path.

| Invocation                                     | Scope                                                  |
| ---------------------------------------------- | ------------------------------------------------------ |
| `/qoq fix`                                     | `qoq.config`'s `srcPath`                               |
| `/qoq fix src/auth/token.ts`                   | those files only                                       |
| `/qoq refactor`                                | `qoq.config`'s `srcPath`                               |
| `/qoq refactor src/modules/npm`                | those paths only                                       |
| `/qoq refactor --decisions auto <paths>`       | unattended: apply the mechanical tier, advise the rest |
| `/qoq bump`                                    | every outdated dependency                              |
| `/qoq bump --scan`                             | also vulnerable ones, via `qoq scan` — experimental    |
| `/qoq plan <requirements file or description>` | —                                                      |
| `/qoq plan <requirements> --tool jira`         | also raise the tickets there — experimental            |
| `/qoq plan <requirements> --diagrams`          | also chart the plan before approval — experimental     |
| `/qoq replan plans/<plan>/`                    | that plan only — refuses on uncommitted changes        |
| `/qoq execute [plans/<plan>/]`                 | omitted → ask, unless exactly one plan is approved     |
| `/qoq execute --source jira`                   | import a milestone from there, run it — experimental   |
| `/qoq execute <plan> --session-limit 60`       | stop before spending past 60% of the 5-hour limit      |
| `/qoq execute <plan> --weekly-limit 80`        | same for the 7-day limit; both default to 100          |
| `/qoq execute <plan> --docs`                   | also document each milestone — experimental, opt-in    |
| `/qoq test <what to cover>`                    | —                                                      |
| `/qoq compress`                                | every `CLAUDE.md` and `AGENTS.md` git tracks           |
| `/qoq compress docs/ skills/qoq/references`    | those paths only                                       |
| `/qoq document`                                | files changed since the merge-base with the default    |
| `/qoq document src/auth`                       | those paths only                                       |
| `/qoq mermaid <description>`                   | print the chart                                        |
| `/qoq mermaid <description> --to docs/a.md`    | write it there — created, or appended                  |
| `/qoq mermaid <description> --to docs/a.md#x`  | at the end of the section whose anchor is `x`          |
| `/qoq sheriff`                                 | files changed since the merge-base, as they stand      |
| `/qoq sheriff src/auth 'src/**/*.ts'`          | a snapshot of those paths — intent not judged          |
| `/qoq sheriff main..HEAD`                      | that range's diff, no plan — intent not judged         |
| `/qoq sheriff <PR link>`                       | any repo's PR, security → proposed comments            |
| `/qoq review <PR link>`                        | any repo's PR vs its description → proposed comments   |
| `/qoq feedback`                                | asks which command or agent it's about                 |
| `/qoq feedback qoq-developer`                  | about that agent — any command, agent, or `qoq`        |

Each flag belongs to the command in its row, and that command's reference owns
it. Three things hold across them. `--scan`, `--docs`, `--diagrams`, `--tool`
and `--source` are experimental, each with a `future.unstable_skill_*` twin in
`qoq.config`; the trackers need flag and twin both, and the flag alone is
refused. `execute`'s security sweep and review run at every milestone, with no
switch. `--decisions auto` is only for the two callers that can't stop to ask:
`execute`'s milestone gate and `bump`. Neither `--tool` nor `--source` makes a
tracker authoritative — the plan directory is the state
([references/export.md](references/export.md)).

## Entry

Invoked with: `$ARGUMENTS`

`<skill>` is `${CLAUDE_SKILL_DIR}`.

1. **The head-of-run checks have already run.** This is `entry.mjs`'s output —
   the agents, the discovery record, any tier mapped to a dearer model, the usage
   stats, a section each with what to
   do about it. Do what the sections say.

   !`node "${CLAUDE_SKILL_DIR}/scripts/entry.mjs" --project "${CLAUDE_PROJECT_DIR}" --command "$0"`

   Once per **top-level** run, keyed to the command the user typed. A command
   invoked from inside another inherits everything the outer run already
   established rather than re-checking — a `fix` dispatched from inside
   `refactor` is part of that refactor, not a second run. So never re-invoke this
   skill for an inner command: that re-runs every check. Instead, each time an
   inner command starts, run `node <skill>/scripts/stats.mjs <inner> --project
   <dir>` once, with the same `<dir>` the entry ran with (it counts that run and
   does nothing else), then
   open its reference. Exit 1 there means consent went unanswered at the top, so
   carry on without asking. Don't report what it prints.

2. **If it reports the record stale**, fill it in from the payload it printed —
   here, on this thread, not in an agent. It's a few reads, and the one move it
   can end in is a question only this thread can ask
   ([references/discovery.md](references/discovery.md)). Note any field you
   repaired for the end-of-run notice.

3. **No command given** → the output above is a single `command` section. Ask,
   then run the line it prints yourself.

4. **Run the command**, then close the run by reporting anything discovery
   repaired — one line per field, _after_ the real work, never before it.

5. **Then the end-of-run question**, if `learn.mjs --due` says it's time —
   [references/feedback.md](references/feedback.md). Top-level runs only.

## Who calls whom

Commands compose, but **only on the main thread**.

| Command    | Calls                                                                                                | Called by                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `fix`      | `scripts/check.mjs`, no agent                                                                        | `refactor`, `bump`, `execute`, `test`, `compress`                   |
| `refactor` | `fix`                                                                                                | `bump`, `execute`, `test`                                           |
| `bump`     | `fix`, `refactor` — both per patch                                                                   | —                                                                   |
| `plan`     | `grilling` + `domain-modeling` (external), `mermaid`                                                 | —                                                                   |
| `replan`   | `grilling` + `domain-modeling` (external), `mermaid`                                                 | —                                                                   |
| `execute`  | `tdd` (external), `fix`, `refactor`, `sheriff`, `review`, `document`, `mermaid`; its own `qoq-retro` | `plan` — offered at approval, never dispatched from inside it       |
| `test`     | `tdd` (external), `fix`, `refactor`                                                                  | —                                                                   |
| `compress` | `writing-for-agents` (external), `fix`                                                               | —                                                                   |
| `document` | its own `qoq-scribe`; offers `mermaid`                                                               | `execute` — per milestone, after the gate                           |
| `mermaid`  | its own `qoq-artist`                                                                                 | `plan`, `replan`, `execute` — when `--diagrams` is on               |
| `sheriff`  | its own `qoq-sheriff`; `fix` to re-gate                                                              | `execute` — every milestone, always                                 |
| `review`   | `code-review` (external), its own `qoq-reviewer` ×2 axes; `fix`; `sheriff`                           | `execute` — every milestone and once per plan, always               |
| `feedback` | —                                                                                                    | every top-level command, at the end, when `learn.mjs --due` says so |

`compress` changes what future runs read, never what this one does, so no
command should be reaching for it mid-task.

Seven skills this one doesn't own are used, two ways. **On this thread**, looked up
in **your own available-skills list** at the moment you need it, because that
list is already in the thread's context and is never out of date: `refactor`'s
assessment 3 is `ponytail-review` (assessment 4 is `qoq-designer`, which ships
here); `plan` and `replan` open with `grilling`, the interview that closes the
gaps in a set of requirements before they become invented acceptance criteria,
with `domain-modeling` writing down the terms and decisions it settles;
`compress` judges every cut against `writing-for-agents`; `review` frames its
two axes on `code-review` and pastes its smell baseline into the Standards one. **Preloaded into an
agent** by its `skills:` frontmatter, never invoked here: `tdd` under every spec
`execute` and `test` write, and `codebase-design` under `qoq-architect`'s
contracts. All seven normally arrive with qoq as plugin dependencies; each
reference states what to do when one is missing anyway. An external skill's
output format is written for a person reading that turn. Inside a qoq run its
findings are the next step's input, never the turn's final text, so carry on to
the step that called it.

## Standing rules

These hold in every command. Each command's reference assumes them rather than
restating them.

**Never assume a default.** Anything unclear is a question for the user, not a
sensible guess with a note afterwards — a guess that looks plausible is worse
than a stop, because nobody notices it. Subagents can't ask, so an agent on any
doubt **writes nothing and returns the question**: a half-written artifact is
indistinguishable from a stale one on the next run. The caller asks and resumes
it with the answer.

**`npx` is for `qoq` and nothing else.** Every other command is the project's own
script, verbatim — `npm test`, `npm run build`, `npm run test:execute -- {file}`.
This skill's `PreToolUse` hook blocks any other `npx`, in agents too, for the
rest of the session.
Never compose `npx vitest …` or `npx tsc …` out of a dependency spotted in
`package.json`: that invocation skips the project's config, flags, and setup
files, and it is plausible enough that nobody notices it was invented. A project
with no script for something is a project that has to be asked.

**Nothing that writes runs in parallel.** Not tickets, not test slices, not
patches, not anything that edits or commits. Every check that matters is an
attribution question — "did _this_ change break it?" — which a second agent
writing concurrently makes unanswerable. Read-only agents may run together
where a reference says so (`review`'s two axes); `refactor`'s assessments stay
sequential for their own reason ([references/refactor.md](references/refactor.md)).

**An agent that reports never fixes.** `qoq-bumper`,
`qoq-designer`, `qoq-architect`, `qoq-test-reviewer`, `qoq-sheriff`, `qoq-reviewer` and `qoq-retro` return findings and edit
nothing. An agent permitted to do both will quietly do both, and the finding
disappears into the diff instead of reaching the user. Where an agent's tools
are wider than its contract, `scripts/agent-guard.mjs` closes the gap as a
`PreToolUse` hook in its frontmatter: a shell allowlist for
`qoq-bumper`, `qoq-sheriff` and `qoq-reviewer`, test files only for
`qoq-tester`. A hand-back that quotes the guard is a contract question for the
user, never a reason to re-dispatch as `general-purpose`.

**Never buy green.** No `.skip`, no loosened assertion, no narrowed ticket, no
weakened gate. If the bar can't be met, that's a report, not something to route
around.

**The gate is the project's `qoq:check`, the fix its `qoq:fix`**, run verbatim
through the forms in `references/cli.yaml`. Discovery asks to add a missing one.
Nothing derives the CLI's flags. Whoever needs it reads `references/cli.yaml` at
the moment they need it. What stays with `fix` is the
_verdict_ — it owns the check/fix loop and the one PASS/FAIL line its callers
read.

## Agents

Eleven, in `agents/`. Each one's model is in its own frontmatter. Four have
none: `qoq-developer` and `qoq-scribe` take the tier passed at dispatch (the
ticket's rating, the scribe's mode), and `qoq-architect` and `qoq-sheriff`
inherit the session's model, because a design error propagates into every
ticket and a missed security finding ships. Never pin a tier on those four.

| Agent               | Job                                                         |
| ------------------- | ----------------------------------------------------------- |
| `qoq-bumper`        | read a changelog, find what lands here — one per package    |
| `qoq-architect`     | contracts · surface · risks · unknowns — one per plan       |
| `qoq-developer`     | one ticket, red → green per criterion — one per ticket      |
| `qoq-test-reviewer` | do the specs test the criteria — one per ticket, pre-commit |
| `qoq-tester`        | write the specs for one slice — one per slice               |
| `qoq-designer`      | stack → smells → patterns — `refactor`'s assessment 4       |
| `qoq-scribe`        | the why, as comments and docs — one per run or milestone    |
| `qoq-artist`        | a validated Mermaid chart, or a reasoned decline            |
| `qoq-sheriff`       | logic-level security findings — one per sweep or recheck    |
| `qoq-reviewer`      | spec · standards axes, in parallel — per milestone or plan  |
| `qoq-retro`         | lessons from retries — per retried milestone, then the plan |

Entry copies them into the project's `.claude/agents/`, because an agent file
inside a skill is registered by nothing, and Claude Code picks that directory up
on its own a moment later. It also deletes the copies of agents this skill has
stopped shipping, so nothing stays dispatchable with a contract that no longer
exists. Do what `entry.mjs`'s **agents** section says: it decides whether a fresh
install is a question or an end-of-run line, and on the one run where an agent
isn't registered yet it prints the `general-purpose` fallback to dispatch
instead.

**Every dispatch passes this skill's absolute path** — the `<skill>` line under
Entry. An agent starts cold and cannot derive it, and it's what `<skill>` stands
for in every path an agent is told to run — `references/cli.yaml` included.

**Retry an agent by resuming it.** When an agent goes back at the same tier with
a digest, a verdict or an answer, use `SendMessage` to the agent that returned,
and send only what's new. It still holds the files it read and its own last
return, so sending either again pays for them twice. Use a fresh dispatch with
the full brief instead, the way every retry worked before resume, when:

- **`SendMessage` isn't available**: it isn't in this session's tools, or the
  call errors
- **the agent is gone**: a later session, or an agent that's no longer
  addressable
- **the tier changes**: an escalation, because a resumed agent keeps its model
- **the ticket changed**: a `plan` handoff the user answered is a different
  ticket, and the old context would mislead
- **it stopped on `maxTurns`**: a partial return is a hand-back and spends an
  attempt. It's never resumed
- **the agent judges**: `qoq-sheriff`, `qoq-reviewer`, `qoq-test-reviewer` and `qoq-retro` are
  cold every time, because a primed reader shares the blind spots it should catch

Write `resumed` or `fresh` on the Log line wherever a Log records the retry.

An agent reported as `kept (edited here)` is the user's own version and stays
that way. Dispatch it like any other; it's registered.

**A tier that doesn't resolve is the user's to remap, never yours.** `opus`,
`sonnet` and `haiku` resolve through Claude Code's
`ANTHROPIC_DEFAULT_*_MODEL` settings, so a dispatch that comes back with a
model error (not found, not enabled, unavailable) means that tier has no model on
this host. Run `node <skill>/scripts/model-tiers.mjs --project <root> --failed
<tier>` and do what it prints. Don't re-dispatch on another tier to get past it,
because a dearer fallback is silent spend. Never write a model or tier choice to
memory, even a confirmed one: the settings file is the one place the user can see
it and undo it. When Claude Code substitutes a model on its own and says so,
relay its notice and carry on.

## Test and code conventions

`tdd` is the base for writing specs — what a good test is, seams, mocking, the
anti-patterns, the red → green loop.
[references/test-conventions.md](references/test-conventions.md) holds the house
rules on top of it and wins where they conflict. Whoever writes a test in this
project reads both rather than reinventing a style.
[references/code-conventions.md](references/code-conventions.md) is its sibling
for production code: names say what, comments say why, and a comment that
predates the change is never removed without a recorded reason. Both are read by
whoever writes or tidies code. Where either conflicts with the project's own file — named
on the record's `conventions` field — **the project's file wins**: it's
human-written and knows things this skill can't infer.
