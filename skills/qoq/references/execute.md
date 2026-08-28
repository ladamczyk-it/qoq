# `qoq execute` — an approved plan in, delivered milestones out

Run a plan to completion by dispatching every ticket to a `qoq-developer` at the
tier the plan already assigned. This command **never implements anything
itself** — its whole job is dispatch, gates, status, and archiving.

## Where the plan comes from — `--source`

`--source local` is the default and needs nothing: a plan path, or the single
approved plan under `./plans/` when the argument is omitted.

`--source jira|linear|trello` asks which milestone to run, reads it and its
tickets into a plan file, and then continues here as if that file had always
existed — [references/export.md](export.md) owns that beat, including the two
places it stops. **Read it before anything else on a non-local source**; nothing
below this section knows or cares where the tickets came from, which is the
whole point of importing rather than executing against a tracker.

One thing from there reaches into the loop below: on an imported plan, a ticket
arriving at `done` or `blocked` also writes its status label and commit back to
the tracker. That is the only write, and it's a label, never a workflow column.

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
- the **milestone's `Contracts`**, verbatim — the shape its specs assert against.
  `none` is a normal value and is worth passing as such.
- the **record's path**, so the agent reads it rather than trusting a pasted copy
- the **path to `references/test-conventions.md`** in this skill — a subagent has
  no way to work out where the skill lives
- the **model** for the ticket's tier, passed explicitly
- the three-attempt budget, with explicit permission to hand the ticket back
  rather than narrow it
- on a re-dispatch after a failed gate: the **digest or the verdict verbatim**,
  plus which attempt this is

**Not the milestone's `Scenarios`.** Those are journey-level and a ticket is not
— they'd be context the developer can't act on, and the one thing worse than
missing context is context that invites work outside the `Files` list.

Write the ticket's **`Log`** at each transition — dispatch, each gate verdict,
each re-dispatch, `done` or `blocked` with the hash. It's orchestrator-written
because only this thread sees the transitions: `Status` says where a ticket
ended, and the `Log` is the only thing that says how it got there.

## The ticket is a full TDD cycle — and there are two refactor beats

**Red, green and refactor all belong to the ticket.** Specs first, every
criterion transcribed and failing in one run because nothing implements them yet;
then green, one criterion at a time; then a tidy of what was just written, inside
the ticket's own **Files**, while green, with no interface change.

**A second refactor beat belongs to the milestone, and it is a different
question.** `qoq refactor --decisions auto` runs over every file the milestone's
tickets touched, which is the first moment those tickets exist as one piece of
code — and cross-ticket findings are only visible there: duplication across four
tickets, a now-dead export, three tickets that each picked a different shape. Per
ticket that scope sees none of it.

So: **ticket-level tidy is about this diff; milestone-level shape is about the
milestone.** Neither substitutes for the other, and a ticket that skips its own
tidy hands the milestone gate a mess it was never meant to sort.

There is no per-ticket standards pass and no complexity-driven routing table: a
`trivial` ticket and a `judgment-heavy` one run identical steps at different
tiers.

### Two gates per ticket, in this order

```
developer hands back → qoq fix (scoped) → qoq-test-reviewer → commit
```

**Gate 1 — `qoq fix`, scoped** to exactly the files the ticket changed, spec and
source both. Scoped, because the verdict has to be about this ticket and nothing
else.

**Gate 2 — `qoq-test-reviewer`**, read-only, over the spec files. Its dispatch
carries those files, the ticket's acceptance criteria, the milestone's
`Contracts`, and the path to `references/test-conventions.md`.

**`qoq fix` runs first because it rewrites formatting**, and there's no point
spending a semantic read on text that's about to change.

**Gate 2 sits before the commit, and that is the whole argument for its cost.** A
ticket marked `done` whose tests assert nothing isn't a deferred problem — it's a
false statement this file then propagates: a `success` filed with the estimator,
downstream tickets built on a behaviour nothing pins, and an archive entry
claiming delivery. Catching it a milestone later means unwinding all three. No
ticket is finished without proof its tests are real.

It's a separate cold agent rather than a read on this thread for two reasons: the
reading volume is what dispatching exists to keep out of the orchestrating
context, and this thread is holding the developer's own report, which primes it to
accept. A cold reader isn't primed.

**Both gates run here, not inside the developer.** The developer proves its own
work — the project's `test:one` and `build`, then the CLI's `scoped` form over
the files it touched — and hands back that list. A `FAIL` or a `REJECTED`
re-dispatches it, and the commit happens here after both gates pass, so nothing
reaches history unproven.

A `REJECTED` verdict is re-dispatched **verbatim, never summarised.** The
developer is forbidden from editing a green assertion on its own judgment, and
this verdict is its single exception — scoped to exactly the assertions the
verdict cites. Summarise it and you've either widened that licence or destroyed
it.

The developer's own scoped run doesn't make Gate 1 redundant: it writes no
reports, so the digest and the retry budget that acts on it both live here. What
it does is stop a whole dispatch-and-gate round being spent on a formatting
finding.

**The attempt budget is three, shared across both gates.** An attempt is an
attempt whichever gate consumed it. Three rounds of feedback and still not right
means the ticket is mis-rated — which is exactly what the escalation ladder acts
on — and separate counters would allow six rounds before the tier moved, double
the worst-case spend on a ticket whose first three rounds already said so. The
estimator also takes one number.

### On `done`: tick the criteria with their evidence

Gate 2's `APPROVED` comes back with the **criterion → assertion mapping** it had
to build to reach that verdict. Tick each acceptance criterion in the plan and
write its `spec/file.ts::test name` beside it, **from that mapping** — never from
your own reading of the diff, which is the reading the gate exists to replace.

Without it a delivered plan reads identically to an undelivered one.

### The test cycle stays the developer's own

It writes the failing assertions, one per acceptance criterion — a criterion the
plan already stated as an assertion needs transcribing, not authoring, and
dispatching an agent to write `expect(res.status).toBe(429)` costs more than
writing it. After green it may **add** cases against `test-conventions.md`, and
may never change what a green assertion expects on its own judgment; Gate 2 is
what independently checks the result.

It doesn't hand any of that to `qoq test` — that dispatch is unavailable to it,
and unnecessary: `qoq test` earns its subagent by _slicing_ a scope nobody has
read yet, and a ticket arrives pre-sliced with its implementation already in the
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

On an imported plan the ticket's **External** field gets the same news — status
label, commit hash as a comment — in the same beat, so the two never drift.

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

Three attempts spent — whether the agent handed back itself, or either gate
rejected it, in any combination — exhausts the ticket at that tier. Re-dispatch
one tier up with the last report and the digest or verdict pasted into the new
prompt — it's the most useful context the
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
   everything shape-changing comes back as an advisory. The specs are in that
   union, so cross-ticket spec problems — duplicated setup across four tickets,
   one boundary mocked three ways — are already assessment 1's job. No third gate
   is needed here.
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

**Record what the gates proved, not that they ran.** The summary block's **Gate
evidence** field takes the refactor's verdict and the suite's result as reported.
"Green" is a claim; "refactor clean, 412 passed / 0 failed" is evidence, and a
`## Completed` block is read by people who can no longer see the run.

## Setup

Two checks: are `qoq-developer` and `qoq-test-reviewer` registered under
`.claude/agents/`? If either isn't, dispatch `general-purpose` with that agent
file's body pasted in — for the developer, with the tier passed explicitly, since
`general-purpose` otherwise inherits the session's model and quietly overrides
the rating the plan made; for the reviewer, with its read-only prohibition
restated, since `general-purpose` gets every tool and would arrive holding the
ability to fix what it was dispatched to report.

Commands come from the record. The plan's **Commands** header is a convenience
copy for a session that has one and not the other — there's no `package.json`
fallback, because discovery has already run before the first ticket dispatches.
