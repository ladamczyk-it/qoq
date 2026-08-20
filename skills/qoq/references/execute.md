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

No parallel mode exists, and no flag for one: two subagents committing into one
index is a failure no gate catches. Because only one ticket is ever in flight,
there's also no disjoint-**Files** constraint to maintain and no per-ticket
scratch directory to isolate.

## Spending limits, when the user asks for them

`--session-limit <pct>` and `--weekly-limit <pct>` cap how much of the account's
5-hour and 7-day limits this run may consume. Either flag arms the gate; the one
not given defaults to 100, so `--session-limit 60` means "stop at 60% of the
session, and only an exhausted week stops the run".

**Neither flag given, no gate** — no check, no number printed, nothing fetched.
The default is the behaviour that existed before the flags did: a plan run left
alone finishes. Someone who wants a ceiling says so, and only they pay for the
per-ticket call.

Armed, run this **before dispatching each ticket** — the answer moves while the
run does, so one check at the start would be a number about a plan that hadn't
started yet:

```bash
node <skill>/scripts/usage-check.mjs --session-limit <pct> --weekly-limit <pct>
```

Pass both, always: the script's own defaults fill in whichever flag the user
left out. Show its stdout to the user verbatim before the dispatch — the
headroom line is what they asked for by setting a limit, and a run that
silently swallows it gives them a gate they can't see working.

Branch on the exit code:

- **0** — dispatch the ticket.
- **1** — a limit is reached. Stop and ask whether to carry on anyway, saying in
  the question that a yes disarms the gate for the rest of this run: the number
  only climbs from here, so re-asking before every remaining ticket is the same
  question over and over. A **no** ends the run cleanly — leave the ticket at
  its current status and tell the user `qoq execute <plan>` resumes it once the
  window rolls over. It is **not** `blocked`, and it files **no** estimate
  outcome: nothing was dispatched, so there's no call to grade.
- **stdout starts with `usage unavailable`** (still exit 0) — the endpoint
  couldn't be reached. Say so in one line and carry on; an outage is not a
  reason to wedge a plan, and the account's real limits enforce themselves
  whether or not this check ran.

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

There is no per-ticket standards pass and no complexity-driven routing table: a
`trivial` ticket and a `judgment-heavy` one run identical steps at different
tiers.

**The per-ticket gate is `qoq fix`, scoped** to exactly the files the ticket
changed — spec and source both. Scoped, because the verdict has to be about this
ticket and nothing else.

**It runs here, not inside the developer** — the gate runs one thread up, per
`SKILL.md`. The developer writes, proves its own work green with the project's
`test:one`, and hands back the file list; this thread dispatches `qoq fix` over
that list and commits on a `PASS`. A `FAIL` re-dispatches the developer with the
digest pasted in, and that round is one of its three attempts.

The commit happens here too, after the gate — nothing reaches history until it
has passed.

**The whole test cycle is the developer's own.** It writes the failing
assertions, one per acceptance criterion — a criterion the plan already stated as
an assertion needs transcribing, not authoring, and dispatching an agent to write
`expect(res.status).toBe(429)` costs more than writing it. Once the code is in,
it raises those same assertions to the project's bar itself, against
`test-conventions.md`: what's worth mocking, the cases a first pass skips. That's
a judgement best made over code that exists, which is why it comes after green
rather than before.

It doesn't hand that step to `qoq test` — that dispatch is unavailable to it, and
unnecessary: `qoq test` earns its subagent by _slicing_ a scope nobody has read
yet, and a ticket arrives pre-sliced with its implementation already in the
writer's context.

## Report the outcome back, once per ticket

The moment a ticket reaches `done` or `blocked`, tell the estimator how its call
turned out — this is the only place in the system that knows, and a plan
approved next week is estimated from it:

```bash
node <skill>/scripts/estimate.mjs --record --tags <the ticket's tags> \
  --stack <the ticket's stack> --tier <the tier the plan assigned> \
  --outcome success|failure --attempts <n> \
  --attribution estimation-miss|scope-expansion --summary "<the ticket title>"
```

Tags and stack come from the ticket's **Estimate** field verbatim, the tier from
its **Agent tier**. The estimate being graded is _this much work at that tier_,
and an outcome filed under a different tier grades a decision nobody made. On an
escalated ticket that still means the tier the **plan** assigned: the rung that
was picked is the thing that turned out to be wrong.

`--attempts` is the count actually spent, including a re-dispatch after a failed
gate and including the attempts that ran at the escalated tier.

**`--outcome` is about delivery, not about how hard it was**, and the two verdicts
it feeds are different questions:

- `success` — the ticket is `done`. Still `success` if it took three rounds and an
  escalation to get there; the attempt count already says the tier was
  mis-picked, and that's a tier problem with a tier-shaped fix.
- `failure` — the ticket ended `blocked`. Nothing delivered it, at any tier the
  ladder could reach. That's the ticket being wrong rather than the model, and
  it's the only thing that makes the estimator recommend a split.

Filing a hard-won `done` as a failure is the mistake to avoid: it tells the next
plan to decompose a ticket that was fine, instead of telling it to spend a bigger
model.

**The attribution is yours to judge, and it's the whole reason this signal is
worth anything.** Two very different things make a ticket take three attempts:

- `estimation-miss` — the ticket was what the plan said it was, and it still
  took more than it was rated for. That's the sizing being wrong, and it belongs
  in the record.
- `scope-expansion` — the developer found work nobody knew was there: a
  migration nothing mentioned, a broken assumption upstream. The ticket that got
  built isn't the ticket that got estimated, so grading the estimate on it
  teaches the next plan a lie. It's counted separately and never touches the
  mean.

When it's genuinely both, call it `scope-expansion`. A false miss quietly
degrades every future estimate for that combination; a missed one costs a single
data point.

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
update downstream tickets' **Context** with anything this milestone established
— _before_ the text moves, while it's still in front of you. Gate advisories go
into the milestone's summary; one that evaporates on archive is worse than one
never looked for.

## Setup

One check: is `qoq-developer` registered under `.claude/agents/`? If not, fall
back per `SKILL.md`'s Agents section — body pasted in, tier passed explicitly,
since `general-purpose` otherwise inherits the session's model and quietly
overrides the rating the plan made.

Commands come from the record. The plan's **Commands** header is a convenience
copy for a session that has one and not the other — there's no `package.json`
fallback, because discovery has already run before the first ticket dispatches.
