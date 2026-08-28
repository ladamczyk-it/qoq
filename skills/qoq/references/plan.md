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

## Sharpen the requirements first — `grilling`

Requirements arrive vaguer than they look. Every gap left in them becomes a
ticket whose acceptance criteria somebody invented, and that invention is
invisible until the ticket is being implemented. `grilling` closes the gaps
while closing them is still cheap: rounds of questions over the whole frontier,
the user answering, until nothing is silently assumed.

**Invoke `grilling`, not `grill-me`.** `grill-me` is the user's front door to
the same interview and cannot be called from here — its frontmatter sets
`disable-model-invocation: true`, and its entire body is one line handing off to
`grilling`. Looking for `grill-me` would report it missing even on a machine
where it's installed.

Look for it in **your own available-skills list**, exactly as `refactor` looks
for `ponytail-review` — that list is already in this thread's context, it's what
the invocation resolves against, and it is never out of date. Nothing about it
is cached. Whatever name the list gives it is the invocation, verbatim; a bare
`grilling` and a `mattpocock-skills:grilling` do not resolve interchangeably, so
don't add or strip a prefix to make it look tidier.

Check it **after the one-ticket stop above and before `Explore`** — that stop is
one cheap read, so nothing is thrown away by taking it first, and there's no
point asking the user to install an interview for work that turns out not to
need a plan at all. Everything after it is the opposite: `Explore`, the
decomposition and the estimator all read the requirements, so a gap still open
when they start is a gap each of them reasons from.

The subsystem stop stays where it is, downstream, because the grill is often
what surfaces it — "these are two unrelated things" is a conclusion a round of
questions reaches, not a property visible in the requirements as handed over.

Installed → invoke it with the requirements. Missing → ask once:

> `grilling` isn't installed, so the clarification round can't run and I'd be
> decomposing the requirements exactly as written.
>
> - **Install and re-run** _(recommended)_ — `/plugin install mattpocock-skills`.
>   It's in Claude Code's official marketplace, so there's nothing to add first.
>   Then `/qoq plan <requirements>` again.
> - **Proceed without it** — I decompose what's written and stop to ask you
>   directly whenever a ticket can't be written from it. That's the same
>   questions arriving one at a time, mid-decomposition, instead of in rounds.

**Recommended is not a veto.** Proceed-without is a real option; take it at the
user's word, decompose in full, and report the skipped round in the approval
summary so it's on the record rather than only in a message they scrolled past.

**Hand it what's already settled**, not just the requirements file. Its rounds
open on the frontier — the questions whose prerequisites are answered — so a
spec that already answers them should produce a short session, not a re-ask of
its own contents. A precise spec ends in one round and costs almost nothing.
Deciding for the user that their spec has no gaps is what costs.

**The grill leaves nothing behind but the conversation.** It's stateless by
design: no files, no workspace, no record. Everything it settled lives only in
this thread, so it has to land in the plan file as you decompose — the
architecture sentence, a ticket's **Context**, the acceptance criterion that
only got sharp because a question was asked. Note on **Requirements source**
that the requirements were grilled. A decision nobody wrote down is one the next
session re-litigates from scratch.

Under `--decisions auto` there is nobody to answer questions: skip the interview,
decompose what's written, and carry the gap into the approval summary.

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

A project that has never run `execute` has no store yet; the script exits `0`
with `"verdict": "baseline"` and your own pick stands. That's the normal first
run, not a failure.

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

## `--tool` — where the tickets end up

`--tool local` is the default and writes the plan file and nothing else.
`jira`, `linear` and `trello` add one beat after approval: raise the milestones
and tickets in that tool. Any other value is a typo rather than a fourth tool —
ask, don't map it to the nearest one.

**The plan file is the source of truth in every mode.** `qoq execute` runs off
`./plans/*.md` and nothing else — even `--source jira`, which imports a
milestone into one first. So the export is a projection for the people who live
in a tracker, never a replacement. `--tool jira` still writes the file,
still gets approved the same way, and an export that fails halfway leaves a plan
that works.

The field mapping, how to find the MCP tools that raise items, and what to do
when either the tool or the destination is unknown are all in
[export.md](export.md). Read it only when `--tool` isn't `local` — a local run
has no use for the field tables of three trackers it will never write to.

## Approval, then handoff

Save to `./plans/YYYY-MM-DD-<feature>.md` with `Plan status: draft`, then ask.
Three things get surfaced at approval because they're the ones a user would want
to veto: **new dependencies** any ticket needs, the **model ceiling** — if a
ticket is rated above the session's own model, no tier exists to escalate to —
and every ticket whose **tier the estimator moved**, with what the bucket's
record was. That last one is a judgement the user is better placed to make than
either the script or you: they know whether this ticket really is the same shape
as the four that went wrong, and it's their model spend.

Say here, too, if the `grilling` round was skipped — installed-and-declined, or
`--decisions auto`. It isn't a veto item; it's the one thing at approval the user
can't see from the plan file, and it changes how hard they should read the
acceptance criteria.

On approval: set `Plan status: approved` and fill the **Commands** header from
the record, so the milestone gate still has the project's full build and test
commands in a session days later with no memory of this one.

Then the two handoffs, in this order — export first, because it's the one that
leaves the machine and the user should see it land before anything starts
changing code:

1. **`--tool` isn't `local`** → offer to raise the items now and do it on a yes,
   following [export.md](export.md). An outward-facing write gets its own
   confirmation; approving a plan is not the same act as publishing it into a
   team's tracker. Declined, the plan file stands on its own and the export can
   be run later.
2. **Offer `qoq execute`** and run it on a yes. Never dispatch a ticket from
   here. The plan file is the entire handoff, and folding execution in would put
   decomposition reasoning back into the context that has to run the plan.
