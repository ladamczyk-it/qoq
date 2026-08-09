# `qoq plan` — requirements in, an approved plan file out

Decompose a spec, PRD, or rough description into milestones and tickets that a
cold subagent can pick up and `qoq execute` can deliver. The plan file is the
whole handoff — it's what lets tomorrow's session resume work this one started.

The file shape is fixed: [../assets/plan-template.md](../assets/plan-template.md).
Copy it structurally, don't improvise sections — an orchestrator resuming a plan
across sessions relies on "Status" and "Definition of done" meaning the same
thing in every ticket it's ever handed.

## Read the requirements, not a summary of them

If the requirements are a file, read the file. A paraphrase in the conversation
has already lost the detail that turns into an acceptance criterion, and that
loss is invisible until a ticket is being implemented.

## When not to write a plan

One ticket's worth of work doesn't get a plan file. Go straight to the code; the
gate alone is the bar. The dispatch machinery costs more than it saves below that
size, and a one-ticket plan is a ceremony that has to be maintained.

Two independent subsystems don't get one plan either. Say so and write separate
plans — a plan with two unrelated halves can never be milestone-ordered
sensibly, and half of it blocks on the other half for no reason.

## `Explore` earns its dispatch

One subagent, read-only, answering the questions no record can cache: which files
look like the work, what patterns the surrounding code already uses, what the
test conventions look like in the area being changed. That's high-volume reading
with no business in the planning context.

Don't ask it for the build and test commands. Those are already on the record,
and asking twice is how two answers appear.

## Acceptance criteria are assertions

This is the rule everything else in decomposition follows from. `execute` opens
every ticket by transcribing its criteria into failing specs, one to one, before
any implementation — so the criteria field is machine-facing.

**"Add rate limiting to the auth routes" is a title. "A 6th request inside 60s
returns 429" is a criterion**, because a spec can be written from it before a line
of implementation exists. Anything phrased as work-to-do rather than
behaviour-to-observe leaves the red beat with nothing to transcribe, and the
agent ends up inventing the assertion it was supposed to be handed.

**A ticket that can't be asserted up front isn't decomposed yet.** That's a
sharper test than the size table and catches a different failure: five files is
an `M`, but "make the config loader more flexible" is unsizeable _because_ nobody
can say what it would assert. Same answer either way — split it, or write down
the behaviour that was actually meant.

## Sizing and complexity

**Size** stops at `M`. There is no `L` ticket: more than five files, or crossing a
subsystem boundary, means the decomposition isn't finished. Milestones use
`S`/`M`/`L`/`XL`, and an `XL` milestone should be its own plan.

**Complexity rates the model and nothing else.** `trivial` | `mechanical` |
`moderate` | `judgment-heavy` picks the agent tier the ticket dispatches at.
It does not decide which checks run — every ticket runs the identical steps.
An inflated rating costs a bigger model and nothing more, which is the right way
round for a rating that's easy to get wrong.

## No test-only tickets for feature work

A ticket that ships a feature carries its specs by construction — they're the red
beat of its own TDD cycle. Splitting "build it" and "test it" into two tickets
describes the same cycle twice and makes the second ticket's subagent write specs
against an implementation whose reasoning it never saw.

Test-only tickets stay legitimate for what they were always for: coverage over
code that already shipped.

## Approval, then handoff

Save to `./plans/YYYY-MM-DD-<feature>.md` with `Plan status: draft`, then ask.
Two things get surfaced at approval because they're the ones a user would want to
veto: **new dependencies** any ticket needs, and the **model ceiling** — if a
ticket is rated above the session's own model, no tier exists to escalate to.

On approval: set `Plan status: approved` and fill the **Commands** header from
the record, so the milestone gate still has the project's full build and test
commands in a session days later with no memory of this one.

Then **offer** `qoq execute` and run it on a yes. Never dispatch a ticket from
here. The plan file is the entire handoff, and folding execution in would put
decomposition reasoning back into the context that has to run the plan.
