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

## Then check the pick against what actually happened last time

Size and tier together are one decision — _this much work, delegated to that
model_ — and the two heuristics above are good defaults for making it. What they
can't know is that on _this_ stack, this _kind_ of ticket has been handed to
haiku four times and needed a retry every time. `qoq execute` records how each
delegation actually went, against the tags the ticket carried and the tier it was
dispatched at, so that record exists — consult it per ticket, after making the
baseline pick yourself:

**1. Tag the ticket.** Multiple tags, not one — they aren't exclusive.
`mechanical` (rote, rule-bound), `architectural` (touches structure or design,
not just implementation), `pattern-repeat` ("another endpoint like that one").
Add a tag when none of those describe the work; the taxonomy is meant to grow.

**2. Name the stack** the ticket lands in — `react`, `nestjs`, `cli`. A repo with
two stacks estimates differently in each, and one averaged bucket hides both.

**3. Ask the script**, which reads what this project has recorded in
`.claude/qoq-estimator.json` — committed, so the calibration travels with a
clone rather than with whichever machine ran the plan:

```bash
node <skill>/scripts/estimate.mjs --tags architectural,mechanical \
  --stack react --size S --tier haiku
```

`--tier` is your baseline pick and takes the literal `session` for
judgment-heavy work — the script has no way to know the session's model ID, and
the ticket records it, not this call. Branch on the exit code:

| Code | Means                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| `0`  | the pick stands — in band, or too little data to argue with it                                                  |
| `1`  | **escalate.** Take the dearer `tier` it returns and flag the ticket so approval sees it                         |
| `2`  | **split.** Tickets of this shape keep going undelivered — rephrase or decompose rather than estimating it as-is |

**A miss is a ticket this tier didn't deliver inside its three-attempt budget**
— blocked, or landed only after escalating. Most of a bucket missing means the
tier was too small, and a bigger model is much the cheaper side of that mistake:
three failed attempts and an escalation cost far more than one rung. So the
adjustment only ever goes up. There's no downgrade, because saving one rung
isn't worth running an experiment on the user's ticket.

Take the `tier` field as returned, rather than re-deriving it from the counts.

`2` is the odd one out: it isn't about the model at all. It fires when tickets
of this shape have been ending up **blocked** — never delivered by anything,
even after `execute` escalated as far as it could. That's the same answer as a
ticket that can't be asserted up front: it isn't decomposed yet.

Write what it returns into the ticket's **Estimate** field, in the template's
one-line shape — tags, stack, verdict, the miss count, and the tier change if
there was one. Not the raw JSON: the rest of that payload is diagnostics for
this call, and a plan file is read by every later ticket. That field is what
closes the loop: `qoq execute` reports each outcome back against exactly those
tags and that tier, so the next plan starts from a record this one improved.

## No test-only tickets for feature work

A ticket that ships a feature carries its specs by construction — they're the red
beat of its own TDD cycle. Splitting "build it" and "test it" into two tickets
describes the same cycle twice and makes the second ticket's subagent write specs
against an implementation whose reasoning it never saw.

Test-only tickets stay legitimate for what they were always for: coverage over
code that already shipped.

## Approval, then handoff

Save to `./plans/YYYY-MM-DD-<feature>.md` with `Plan status: draft`, then ask.
Three things get surfaced at approval because they're the ones a user would want
to veto: **new dependencies** any ticket needs, the **model ceiling** — if a
ticket is rated above the session's own model, no tier exists to escalate to —
and every ticket whose **tier the estimator moved**, with what the bucket's
record was. That last one is a judgement the user is better placed to make than
either the script or you: they know whether this ticket really is the same shape
as the four that went wrong, and it's their model spend.

On approval: set `Plan status: approved` and fill the **Commands** header from
the record, so the milestone gate still has the project's full build and test
commands in a session days later with no memory of this one.

Then **offer** `qoq execute` and run it on a yes. Never dispatch a ticket from
here. The plan file is the entire handoff, and folding execution in would put
decomposition reasoning back into the context that has to run the plan.
