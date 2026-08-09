# `qoq execute` — an approved plan file in, delivered milestones out

Run a plan to completion by dispatching every ticket to a `qoq-developer` at the
tier the plan already assigned. This command **never implements anything
itself** — its whole job is dispatch, gates, status, and archiving.

## Loading and resuming

**Load the plan fresh from disk every time**, resume or not. The file is the
state — an in-memory copy from earlier in the session goes stale the moment a
ticket writes its commit hash back.

A ticket sitting at `in-progress` means a previous run died mid-flight.
Reconcile against `git log`: if the ticket's files were committed, mark it
`done`; otherwise re-dispatch it. Don't ask the user to remember what happened.

`Plan status: draft` means it was never signed off — send it back to `qoq plan`
rather than executing an unapproved plan.

**Branch check.** On the default branch, ask before dispatching anything: a plan
run produces a commit per ticket, and that's not something to discover on
`master` afterwards. Suggest `plan/<name>`.

## One ticket at a time

Tickets go out singly, in dependency order then plan order — the first whose
dependencies are all `done`.

No parallel mode exists, and no flag for one. Waves buy wall-clock time and cost
a class of failure no gate catches: two subagents committing into one index, one
ticket's half-written file failing another's validation, a history that has to be
untangled by hand. Because only one ticket is ever in flight, there's also no
disjoint-**Files** constraint to maintain and no per-ticket scratch directory to
isolate.

## The dispatch

Every dispatch carries, verbatim:

- the ticket's **id**, **Context**, **Files**, and **Acceptance criteria** —
  never "see the plan", which resolves to nothing on the other side
- the **record's path**, so the agent reads it rather than trusting a pasted copy
- the **path to `references/test-conventions.md`** in this skill — a subagent has
  no way to work out where the skill lives
- the **model** for the ticket's tier, passed explicitly
- the three-attempt budget, with explicit permission to hand the ticket back
  rather than narrow it
- on a re-dispatch after a failed gate: the **digest verbatim**, plus which
  attempt this is

## The ticket is a TDD cycle, and the cycle is bigger than the ticket

**Red and green belong to the ticket.** Specs first, transcribed from the
acceptance criteria and failing because nothing implements them yet; then the
implementation that makes them pass.

**The third beat belongs to the milestone.** `refactor` runs over every file the
milestone's tickets touched, which is the first moment those tickets exist as one
piece of code and therefore the first moment "is this the right shape" is
answerable at all. Per ticket the scope is too small to see anything.

That's why there's no per-ticket standards pass and no complexity-driven routing
table: a `trivial` ticket and a `judgment-heavy` one run identical steps at
different tiers.

**The per-ticket gate is `qoq fix`, scoped** to exactly the files the ticket
changed — spec and source both. Scoped, because the verdict has to be about this
ticket and nothing else.

**It runs here, not inside the developer** — the gate runs one thread up, per
`SKILL.md`. The developer writes, proves its own work green with the project's
`test:one`, and hands back the file list; this thread dispatches `qoq fix` over
that list and commits on a `PASS`. A `FAIL` re-dispatches the developer with the
digest pasted in, and that round is one of its three attempts.

Committing after the gate rather than inside the agent falls out of the same
move, and is the better place for it anyway: nothing reaches history until it has
passed, and "one ticket, one commit" stops depending on an agent's discipline.

**The whole test cycle is the developer's own.** It writes the failing
assertions, one per acceptance criterion — a criterion the plan already stated as
an assertion needs transcribing, not authoring, and dispatching an agent to write
`expect(res.status).toBe(429)` costs more than writing it. Once the code is in,
it raises those same assertions to the project's bar itself, against
`test-conventions.md`: what's worth mocking, the cases a first pass skips. That's
a judgement best made over code that exists, which is why it comes after green
rather than before.

It doesn't hand that step to `qoq test` — that dispatch is unavailable to it too,
and unnecessary: `qoq test` earns its subagent by _slicing_ a scope nobody has
read yet, and a ticket arrives pre-sliced with its implementation already in the
writer's context.

## Escalation

Three attempts spent — whether the agent handed back itself or the gate failed
three rounds — exhausts the ticket at that tier. Re-dispatch one tier up with the
last report and digest pasted into the new prompt — it's the most useful context the
next attempt can have. Record the escalation on the ticket even when the
escalated run then passes: it's how a resume knows not to retry the tier that
already failed, and how the user sees which tickets were mis-rated.

At the top rung there's nowhere to escalate to. Mark the ticket `blocked` and
bring the user the report. Two things it could mean, and the report usually says
which: the ticket is bad, or the session's own model is too small for it.

## The milestone gate

When every ticket in a milestone is `done` or `blocked`:

1. `qoq refactor --decisions auto <union of every ticket's files>`.
   `--decisions auto` because nobody is watching — the safe tier is applied and
   everything shape-changing comes back as an advisory.
2. The project's **full** build and test suite from the record — not the scoped
   variants a ticket gate uses.

Red → write the failure up as a new ticket: sized, rated, dispatched like any
other. Don't patch it on this thread; the lead doesn't implement.

Green → **archive**. Move the milestone's full text to
`<plan-name>.completed.md`, leave the summary block under `## Completed`, and
update downstream tickets' **Context** with anything this milestone actually
established — _before_ the text moves, while it's still in front of you.
Advisories from the gate go into the milestone's summary; an advisory that
evaporates on archive is worse than one never looked for.

## Setup

One check: is `qoq-developer` registered under `.claude/agents/`? If not, fall
back per `SKILL.md`'s Agents section — body pasted in, tier passed explicitly,
since `general-purpose` otherwise inherits the session's model and quietly
overrides the rating the plan made.

Commands come from the record. The plan's **Commands** header is a convenience
copy for a session that has one and not the other — there's no `package.json`
fallback, because discovery has already run before the first ticket dispatches.
