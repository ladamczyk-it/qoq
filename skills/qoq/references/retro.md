# The retro — what a run's retries say about the next one

`qoq execute`'s own learning step. Always on. A milestone where every ticket
landed first try has nothing to teach and gets no retro; one where any agent
needed a second attempt does, because each retry is the plan, the project or this
skill being wrong in a way the next run will repeat unless something changes.

## Contents

- [Failure reasons](#failure-reasons)
- [The milestone retro](#the-milestone-retro)
- [Three kinds of lesson](#three-kinds-of-lesson)
- [The final retro](#the-final-retro)
- [The follow-up milestone](#the-follow-up-milestone)
- [Recording and sending](#recording-and-sending)

## Failure reasons

A retro reads only what the `Log` holds, so every failure is logged with three
parts, never fewer:

```
<gate or agent> FAIL — <category> — <evidence>
```

- **gate or agent**: `qoq fix`, `qoq-test-reviewer`, `qoq-sheriff`, or
  `qoq-developer` for a handoff
- **category**: exactly one of the list below
- **evidence**: the concrete thing. The rule and `file:line`, the assertion the
  verdict cites, the developer's `blocker` quoted. Never a summary like "lint
  failed"

| Category          | The attempt failed because                                                         |
| ----------------- | ---------------------------------------------------------------------------------- |
| `misread-spec`    | a criterion or Contract was understood differently from how the plan meant it      |
| `missing-context` | the ticket's Context lacked something the work needed, found by reading the repo   |
| `wrong-files`     | the work needed a file the **Files** list didn't name, or named one it didn't need |
| `contract`        | the milestone's Contract was wrong or couldn't be asserted                         |
| `convention`      | a lint, format or house-style rule the developer didn't follow                     |
| `test-integrity`  | a spec that asserted nothing real, which is what most `REJECTED` verdicts are      |
| `tool-error`      | a tool or command crashed, hung or wasn't installed. Not a finding about the code  |
| `flaky`           | the same code passed and failed on different runs                                  |
| `budget`          | turns or attempts ran out with none of the above as the cause                      |

The orchestrator picks the category for a gate failure. The developer picks its
own on a handoff (`blocker_category` in `agents/qoq-developer.md`'s return
block). A handoff with no `blocker` or no `blocker_category` isn't a reason. Resume
the developer once and ask for both. That costs no attempt, since nothing was
tested. A `maxTurns` stop has no block to ask about, so log it as `budget` with
the last gate's evidence.

## The milestone retro

**Trigger**: any ticket in the milestone whose `Log` shows more than one attempt,
an **Escalation**, or `blocked`. No such ticket means no retro and no Retro line.

It runs after the document step and before archive, so it reads the milestone as
it was finally delivered, and its section moves to the archive with the rest.

Dispatch **`qoq-retro`** cold, with:

- the milestone's full text: Goal, Contracts and every ticket, `Log`s included
- the milestone's gate advisories: refactor, sheriff, review
- the project's steering files by path: `CLAUDE.md`/`AGENTS.md` and the record's
  `conventions` file
- this skill's absolute path

It returns lessons in the shape below. Write them into the milestone, under the
Definition of done, as **`### Milestone <N> — Retro`**, verbatim. Then set the
summary block's **Retro** line to the count per kind.

**The retro changes nothing mid-run.** Nobody is watching, and a fix applied now
is applied on the strength of one milestone. Lessons wait for the final retro.

## Three kinds of lesson

Each lesson is one line:

```
- L<n> · <kind> · <category> — <lesson> — from <ticket> attempt <n>: <the Log line it rests on>
  → <the concrete change it proposes>
```

**`code`**: about this project's code, config, or how it's meant to be read.
Categories come from the `retro` skill: `navigation`, `automated-check`,
`coding-standard`, `steering`, `tool-economy`, `information-access`. Applying it
is project work, so it goes to the follow-up milestone:

- **mechanical** (a banned API, an import shape, a file-location rule) → a ticket
  that adds a deterministic check: a lint rule, a hook or a CI step. Build the
  check rather than writing the rule down. A rule in prose is read by the next
  developer and then broken by the one after.
- **judgement** (cross-file consistency, "matches the surrounding style") → a
  ticket that writes it into the project's docs where the next plan's architect
  reads it: the record's `conventions` file, or `./docs`.

Code lessons never leave the machine.

**`planning`**: the plan was wrong, not the code. Categories: `decomposition` (a
ticket that should have been two), `ticket-context` (Context or Files that left
the developer guessing), `contract`, `estimate` (wrong shape for the tags, not
wrong tier). Tier mis-rating is not a lesson. The estimator already grades it from
`--attempts`, and a second copy of that signal would argue with the first.

**`skill`**: about qoq itself, such as an agent brief that steered the developer
wrong, a reference that was missing a rule, or a gate that caught nothing. A
follow-up milestone in this project can't fix the plugin, so they're recorded for
the next plan to work around, and reported as upstream findings. Categories are the same six as `code`
lessons, since a skill is steering too.

## The final retro

First beat once the last milestone archives, and only if a milestone had a
Retro. Dispatch `qoq-retro` once more with every milestone's Retro section (from
`<plan-name>.completed.md`) and the plan's header. It merges lessons that say the
same thing and ranks them by how many milestones they recur in. A lesson seen in
three milestones is a pattern. Seen once, it may be an accident.

Bring the user the merged summary, grouped by kind. Planning and skill lessons
need no approval: they're recorded as soon as the summary exists (below), since
they change no code and the next plan only reads them as advice. **Code lessons
are the one question**, and only when there are any: add a follow-up milestone
for them? They change the project, so they wait for a yes.

Write the summary into the plan as **`## Retro`**, above `## Completed`, whatever
the answers. The plan stays the one record of what this run learned.

## The follow-up milestone

On a yes, append one milestone to the **same plan**, named
`Follow-up: retro lessons`, with **`Follow-up of:** retro` on its header. It stays
in the same plan rather than a new one because a separate plan file can outlive
the run that wrote it unexecuted, while an unfinished milestone keeps this plan
visibly unfinished.

Decompose it on this thread with [plan.md](plan.md)'s Phase 3 rules: sizing,
criteria as assertions, the estimator per ticket. Its requirements are the
approved code lessons, so there's no grill and no architect. Show it to the user
for approval like any milestone, then carry straight on into it.

It gets its own milestone retro like any other. **It never gets a follow-up of
its own.** A plan holds one follow-up milestone at most, so the final beat, when
it comes round again, only reports. Otherwise a run that keeps finding something
never ends.

## Recording and sending

Right after the summary, without asking:

**Planning and skill lessons → the estimator**, locally. Nothing leaves the
machine, so there is nothing to consent to:

```bash
node <skill>/scripts/estimate.mjs --lesson --kind planning|skill \
  --tags <the ticket's tags> --stack <the ticket's stack> \
  --category <category> --text "<lesson>"
```

`qoq plan` reads them all back, for the architect and for every ticket's
estimate. A skill lesson there tells the planner where qoq's own briefing falls
short, so it can write the missing piece into the ticket's Context instead.

**Planning and skill lessons → the learning sink**, only with consent:

```bash
node <skill>/scripts/learn.mjs --project <root> --category <category> --text "<lesson>"
```

Exit 3 means the text still names something from this project. Rewrite it and
call again. Exit 1 means nobody has been asked yet. Put the disclosure it prints
to the user with AskUserQuestion, then call again with `--consent yes|no`. That
consent is asked once, ever, and is separate from stats, because stats promises a
count and nothing more.

Before sending, rewrite each lesson so it names no path, identifier, package,
project or line of code. The script refuses what it can detect, but a lesson
about "the `useRateLimit` hook" is project detail that no pattern catches. The
summary lists the exact text that was sent.

Code lessons are never sent.
