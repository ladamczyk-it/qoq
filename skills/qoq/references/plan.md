# `qoq plan` — requirements in, an approved plan directory out

Decompose a spec, PRD, or rough description into milestones and tickets that a
cold subagent can pick up and `qoq execute` can deliver. The plan directory is
the whole handoff — it's what lets tomorrow's session resume work this one
started.

The shape is fixed — an `index.md` plus one `m<N>-<slug>.md` per milestone:
[../assets/plan-template.md](../assets/plan-template.md).
Copy it structurally, don't improvise sections — an orchestrator resuming a plan
across sessions relies on "Status" and "Definition of done" meaning the same
thing in every ticket it's ever handed.

**Three phases, in order.** Scope settles _what_, design settles _how_, breakdown
settles _who does which piece_. Each one's output is the next one's input, and
running them out of order is how a plan ends up with acceptance criteria nobody
can trace to a requirement.

## Contents

- [Phase 1 — Scope](#phase-1--scope)
  - [Read the requirements, not a summary of them](#read-the-requirements-not-a-summary-of-them)
  - [When not to write a plan](#when-not-to-write-a-plan)
  - [Sharpen the requirements first — `grilling`](#sharpen-the-requirements-first--grilling)
  - [Then write the Scenarios](#then-write-the-scenarios)
- [Phase 2 — Design](#phase-2--design)
  - [`Explore` earns its dispatch](#explore-earns-its-dispatch)
  - [When the architect is skipped](#when-the-architect-is-skipped)
  - [Dispatch `qoq-architect`](#dispatch-qoq-architect)
  - [Ask the Unknowns before Phase 3 starts](#ask-the-unknowns-before-phase-3-starts)
  - [Where the output lands](#where-the-output-lands)
- [Phase 3 — Breakdown](#phase-3--breakdown)
  - [Planning a repo's share of a feature](#planning-a-repos-share-of-a-feature)
  - [Two independent subsystems don't get one plan](#two-independent-subsystems-dont-get-one-plan)
  - [How to slice](#how-to-slice)
  - [Acceptance criteria are assertions](#acceptance-criteria-are-assertions)
  - [Sizing and complexity](#sizing-and-complexity)
  - [Then check the pick against what actually happened last time](#then-check-the-pick-against-what-actually-happened-last-time)
  - [No test-only tickets for feature work](#no-test-only-tickets-for-feature-work)
  - [Self-review — the definition-of-ready gate](#self-review--the-definition-of-ready-gate)
  - [Diagrams — when switched on](#diagrams--when-switched-on)
  - [`--tool` — where the tickets end up](#--tool--where-the-tickets-end-up)
  - [Approval, then handoff](#approval-then-handoff)

## Phase 1 — Scope

### Read the requirements, not a summary of them

If the requirements are a file, read the file. A paraphrase in the conversation
has already lost the detail that turns into an acceptance criterion, and that
loss is invisible until a ticket is being implemented.

### When not to write a plan

One ticket's worth of work doesn't get a plan. Go straight to the code; the
gate alone is the bar. The dispatch machinery costs more than it saves below that
size, and a one-ticket plan is a ceremony that has to be maintained.

The other stop — two independent subsystems — lives in Phase 3, because the grill
is often what surfaces it. "These are two unrelated things" is a conclusion a
round of questions reaches, not a property visible in the requirements as handed
over.

### Sharpen the requirements first — `grilling`

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

Resolve it from your own available-skills list, under whatever name that list
gives it — a bare `grilling` and a `mattpocock-skills:grilling` do not resolve
interchangeably, so don't add or strip a prefix to make it look tidier.

Check it **after the one-ticket stop above and before Phase 2** — that stop is
one cheap read, so nothing is thrown away by taking it first, and there's no
point asking the user to install an interview for work that turns out not to
need a plan at all. Everything after it is the opposite: `Explore`, the
architect, the decomposition and the estimator all read the requirements, so a
gap still open when they start is a gap each of them reasons from.

Installed → invoke it with the requirements. Missing → ask once:

> `grilling` isn't installed, so the clarification round can't run and I'd be
> decomposing the requirements exactly as written.
>
> - **Install and re-run** _(recommended)_ — `/plugin install mattpocock-skills`.
>   It normally arrives with qoq as a plugin dependency, and it's in Claude
>   Code's official marketplace, so there's nothing to add first.
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

**Alongside it, `domain-modeling`.** Resolve it from the same list the same way
and invoke it **just before** `grilling`, so its discipline runs during the
interview: a term that conflicts with `GLOSSARY.md` is called out, a fuzzy one
gets a canonical name, and each term and decision is written into `GLOSSARY.md`
or an ADR under `docs/adr/` the moment it crystallises — the files every
`qoq-developer` reads through `tdd`. Those files are the **user's**, not the
plan's and not `qoq-scribe`'s: list each one written or changed in the approval
summary, and leave them in the working tree for the user to review. Missing, or
the grill skipped → no `domain-modeling` either; put it on the approval's
skipped list rather than asking — `grilling`'s question already offered the
install, and it's the same plugin.

**The grill leaves nothing behind but the conversation** — beyond what
`domain-modeling` wrote, which is vocabulary and decisions, not the plan. It's
stateless by design: no workspace, no record. Everything it settled lives only in
this thread, so it has to land in the plan as you decompose — the
architecture sentence, a ticket's **Context**, the acceptance criterion that
only got sharp because a question was asked. Note on **Requirements source**
that the requirements were grilled. A decision nobody wrote down is one the next
session re-litigates from scratch.

Under `--decisions auto` there is nobody to answer questions: skip the interview,
decompose what's written, and carry the gap into the approval summary.

### Then write the Scenarios

Phase 1's artifact is the milestone **`Scenarios`** field: the journeys this
milestone has to make true, in the user's language, as `**Given** … **When** …
**Then** …` prose.

They come **from what the grill settled** — they are the settled requirements
restated as observable journeys, not a fresh invention alongside them. If you're
writing a scenario the interview never touched, you're guessing, and that guess
is exactly what the interview existed to prevent.

A scenario is not an acceptance criterion, and neither can express the other. A
criterion is one ticket's assertion — _"a 6th request inside 60s returns 429"_.
A scenario spans tickets — _"**Given** a signed-in user who has just hit the
limit, **When** they retry after the window, **Then** the request succeeds and
the counter has reset"_. Nothing else in the plan holds the second, and a
milestone's whole claim is that it is independently shippable, which is a
statement about journeys rather than about assertions.

They earn their place twice downstream: the architect consumes them, because a
journey constrains a contract, and Phase 3 derives acceptance criteria from them,
which is the cheapest available guard against a criterion nobody can trace to a
requirement.

**More than about six per milestone means the milestone is too big** — the same
test the `XL` rule applies, reached from the other direction.

Prose, not Gherkin. The intended consumer is a model and needs no formal grammar,
while real Gherkin invites someone to point Cucumber at the plan, and then
it wants step definitions and a framework nobody asked for. The bolded keywords
keep it greppable without inviting a runner.

## Phase 2 — Design

### `Explore` earns its dispatch

One subagent, read-only, answering the questions no record can cache: which files
look like the work, what patterns the surrounding code already uses, what the
test conventions look like in the area being changed. That's high-volume reading
with no business in the planning context.

Don't ask it for the build and test commands. Those are already on the record,
and asking twice is how two answers appear.

Its brief is unchanged by everything below: **`Explore` locates, the architect
audits.** By its own description it reads excerpts rather than whole files, which
is what makes it cheap and what makes it insufficient on its own.

### When the architect is skipped

One condition, and **every clause has to hold**: the work lands inside a single
existing module, invents no data shape, payload or persisted field, and adds no
dependency. That is the plan whose design output would have been three short
"none"s — and it's the same plan whose `Contracts` field will legitimately read
`none`.

The condition is decidable from what you already hold: the requirements and
`Explore`'s findings. A boundary crossed, a shape invented, or a dependency
proposed dispatches the architect — **and so does any doubt about which of those
is true.** A skip guessed at is the pass being guessed away.

Report a skipped architect at approval, beside a skipped grill. It's the other
thing at approval the user can't see from the plan, and it changes how hard
they should read a `Contracts: none`.

### Dispatch `qoq-architect`

One agent, once per plan, after `Explore` and before any decomposition. It reads
deep in what `Explore` located and returns the interface the tickets have to hit.

It exists because nothing else in the pipeline reads deeply enough at plan time
to find what will break, and `execute` already files that failure by name:
`scope-expansion`, _the developer found work nobody knew was there_. Everything
the architect returns is bought to move that discovery onto the page.

Its dispatch carries, verbatim:

- the requirements, and what the grill settled
- **the `Scenarios`** — journeys are _what_, contracts are _how_, and that is the
  order. A contract that can't serve a journey is wrong however clean it is.
- `Explore`'s findings
- **the retro's planning and skill lessons** for each stack the plan touches:
  `node <skill>/scripts/estimate.mjs --lessons --stack <stack>`. Each one is a
  past plan's mistake on this stack, written down so this plan doesn't repeat
  it. An empty list is the normal first run.
- this skill's absolute path

It returns four sections: **Contracts**, **Integration surface**, **Risks**,
**Unknowns**. It never edits, and it never guesses a contract. It designs with
`codebase-design`'s vocabulary, preloaded by its `skills:` frontmatter; a return
opening `codebase-design: not loaded` means the plugin is missing or off, and
goes on the approval's skipped list.

### Ask the Unknowns before Phase 3 starts

A subagent can't ask the user, so ambiguity comes back as questions. **Ask them
here, on this thread, and get answers before decomposing.** An invented contract
reads exactly like a real one on the page, and every ticket downstream would be
written against it before anyone noticed it was fiction.

If the answers change the shape, resume the architect (SKILL.md) with only the
answers. It already holds the files it read, and re-reading them would be the
most expensive pass in the plan. If it can't be resumed, re-dispatch it with the
full brief plus the answers. If they don't change the shape, fold them in
yourself.

Under `--decisions auto` nobody answers them. Each one goes into the approval
summary, and into the **Context** of the ticket it would change. It never goes
into a new section of the plan: `index.md` holds the template's sections and
nothing else. An open question parked in the index is one no dispatch ever
carries, and it stays there after it's answered.

### Where the output lands

- **Contracts** → the **milestone's** `Contracts` field. Its tickets share one
  interface — one implements it, another asserts it — and `qoq execute` passes it
  verbatim into every dispatch and into the test-review gate.
- **Integration surface** and **Risks** → the relevant tickets' **Context**. This
  is the anti-scope-expansion payload: it's what stops a cold subagent
  discovering the eleventh caller of a type at implementation time.
- **Risks** also feed **sizing** in Phase 3 — a ticket with a named risk against
  it is not the same size as one without.

## Phase 3 — Breakdown

### Planning a repo's share of a feature

A plan can be one repo's share of a **cross-repo feature**: one feature across several
repos, coordinated by a chief-of-staff session that started this one. When the
launch prompt names a chief of staff, the
requirements are the whole BRD, and the parked technology questions that land
here become the first round of `grilling`. **Decide first whether anything lands
in this repo.** If nothing does, write no plan and report
`no changes needed — <one line why>` to the chief of staff: that's a valid
outcome, and it unblocks the repos planned after this one. Every grilling round and the
approval go to the chief of staff with `SendMessage`, never to a local prompt.
On top of the usual plan:

- the `Feature` header line, and a **Serves** column in the Milestones table
  ([plan-template.md](../assets/plan-template.md#a-repos-share-of-a-feature));
- a contract consumed from `../contracts/<name>.md` goes **verbatim** into the
  consuming milestone's `Contracts`, and that milestone `Depends on` the
  contract's provider, written `<repo>:M<N>`;
- a contract this repo provides, once the plan is approved, is written to
  `../contracts/<name>.md` before you report back;
- **Depends on lists only hard dependencies**: what this milestone can't be
  built without. Don't chain a milestone to the one before it by default. Row
  order is the delivery order, and the chief of staff may ask for the rows to be
  reordered so another repo is unblocked sooner. Apply that as asked: the order
  changes, while every number, dependency and file stays as it is;
- a piece another repo needs (a contract, translations, a shared endpoint) goes
  in its own small milestone, so the consumer waits for that piece alone.

### Two independent subsystems don't get one plan

Say so and write separate plans — a plan with two unrelated halves can never be
milestone-ordered sensibly, and half of it blocks on the other half for no
reason.

### How to slice

These rules come from mattpocock-skills' `to-tickets`. It can't be invoked
from here, because its frontmatter sets `disable-model-invocation: true`.

- **Vertical, not horizontal.** A ticket cuts a narrow but complete path
  through every layer the feature touches (schema, logic, route, UI, the specs
  for each), and is verifiable on its own. "All the migrations, then all the
  routes, then all the UI" is three tickets that each pass their gates and
  deliver nothing until the last one lands. A defect in how the layers meet
  then shows up only at the end, when every ticket is already committed.
- **Prefactor first.** Make the change easy, then make the easy change. When
  the feature would be simpler if existing code were reshaped first (a function
  split, a type widened, a duplicate merged), that reshaping is its own ticket,
  with no behaviour change. Its criteria assert the existing behaviour still
  holds, and every feature ticket that relies on it `Depends on` it.

These change how the work is cut, never how a ticket is written: **Files**
stay exact paths and criteria stay assertions. `to-tickets` leaves file paths
out because they go stale in a tracker. A qoq ticket is executed straight
away, and its **Files** is the scope a remediation is checked against.

### Acceptance criteria are assertions

This is the rule everything else in decomposition follows from. `execute` opens
every ticket by transcribing its criteria into failing specs, one to one, before
any implementation — so the criteria field is machine-facing.

**"Add rate limiting to the auth routes" is a title. "A 6th request inside 60s
returns 429" is a criterion**, because a spec can be written from it before a line
of implementation exists. Anything phrased as work-to-do rather than
behaviour-to-observe leaves the red beat with nothing to transcribe, and the
agent ends up inventing the assertion it was supposed to be handed.

**Derive them with the `Scenarios` in view.** Each criterion should be traceable
to the journey it serves, which gives it a parent rather than an author. A
criterion that serves no scenario is either an invention or evidence the scenario
list is incomplete — and either way it's a question, not a ticket.

Where the milestone has a `Contracts` shape, write the criteria **against that
shape**. The developer asserts against the contract, not against whatever its own
implementation ends up returning, and it can only do that if the criteria are
phrased in those terms.

**A ticket that can't be asserted up front isn't decomposed yet.** That's a
sharper test than the size table and catches a different failure: five files is
an `M`, but "make the config loader more flexible" is unsizeable _because_ nobody
can say what it would assert. Same answer either way — split it, or write down
the behaviour that was actually meant.

### Sizing and complexity

**Size** stops at `M`. There is no `L` ticket: more than five files, or crossing a
subsystem boundary, means the decomposition isn't finished. Milestones use
`S`/`M`/`L`/`XL`, and an `XL` milestone should be its own plan.

**Complexity rates the model and nothing else.** `trivial` | `mechanical` |
`moderate` | `judgment-heavy` picks the agent tier the ticket dispatches at.
It does not decide which checks run — every ticket runs the identical steps.
An inflated rating costs a bigger model and nothing more, which is the right way
round for a rating that's easy to get wrong.

**Security sweep**: propose `ticket` for a ticket that touches
authentication or authorization, parses input from outside the process, or
handles a secret, and leave the field off everywhere else — off means the
milestone sweep only ([sheriff.md](sheriff.md)). It's a proposal: the user
confirms each one at approval.

### Then check the pick against what actually happened last time

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

**Read its `lessons` too.** They're what the retro recorded against this exact
bucket: a planning lesson, such as a Context that left the developer guessing or
a ticket that should have been two, or a skill lesson, such as a gap in qoq's own
briefing that this ticket's Context has to fill. Apply each one to the ticket before you write it.
One that doesn't apply goes on the approval's list with a line saying why.

`2` is the odd one out: it isn't about the model at all. It fires when tickets
of this shape have been ending up **blocked** — never delivered by anything,
even after `execute` escalated as far as it could. That's the same answer as a
ticket that can't be asserted up front: it isn't decomposed yet.

Write what it returns into the ticket's **Estimate** field, in the template's
one-line shape — tags, stack, verdict, the miss count, and the tier change if
there was one. Not the raw JSON: the rest of that payload is diagnostics for
this call, and a milestone file is read by every later ticket. That field is what
closes the loop: `qoq execute` reports each outcome back against exactly those
tags and that tier, so the next plan starts from a record this one improved.

### No test-only tickets for feature work

A ticket that ships a feature carries its specs by construction — they're the red
beat of its own TDD cycle. Splitting "build it" and "test it" into two tickets
describes the same cycle twice and makes the second ticket's subagent write specs
against an implementation whose reasoning it never saw.

Test-only tickets stay legitimate for what they were always for: coverage over
code that already shipped.

### Self-review — the definition-of-ready gate

Before approval, read your own plan back as the cold subagent that will be handed
one ticket of it and nothing else. This is the readiness bar, and naming it makes
it something a reader can point at:

- **coverage** — every requirement and every scenario has a ticket behind it
- **no placeholders** — "similar to Ticket 1.3", "handle edge cases", "the auth
  module" are all unfinished work wearing the shape of finished work
- **exact `Files`** — paths, not descriptions. A subagent should never have to
  grep the repo to find out what "the relevant file" meant.
- **every criterion assertable** before the implementation exists, against the
  milestone's `Contracts` where there is one
- **standalone `Context`** — enough that the ticket needs no other ticket, and no
  part of this conversation, to be done

A ticket that fails any of these isn't ready to dispatch, and the cost of finding
that out here is one edit rather than three attempts and an escalation.

### Diagrams — when switched on

`--diagrams`, or `future.unstable_skill_diagrams: true` in `qoq.config`, adds one
dispatch here, after self-review and before approval: `qoq-artist` charts the
drafted plan into its `## Diagrams` section, so the user approves the shape as
well as the text. Off, nothing runs. [mermaid.md](mermaid.md) owns the dispatch
and the veto.

### `--tool` — where the tickets end up

`--tool local` is the default and writes the plan directory and nothing else.
`jira`, `linear` and `trello` add one beat after approval: raise the milestones
and tickets in that tool. Any other value is a typo rather than a fourth tool —
ask, don't map it to the nearest one.

**The three trackers are experimental; only `local` is tested.** Each is on only
when the project's `qoq.config.*` sets its own switch —
`future: { unstable_skill_plan_jira: true }`, `…_linear`, `…_trello` — one Grep
for `unstable_skill_plan_<tool>\s*:\s*true`, read as source text and never
evaluated. Check it **before Phase 1**: switch off is a one-line stop that names
the switch, with nothing grilled and nothing written, because finding out after
approval would throw away the whole session. The flag alone never turns it on —
an untested write into a team's tracker is a per-project decision, not a
per-run one.

**The plan directory is the source of truth in every mode.** `qoq execute`
runs off `./plans/<plan>/` and nothing else — even `--source jira`, which imports a
milestone into one first. So the export is a projection for the people who live
in a tracker, never a replacement. `--tool jira` still writes the directory,
still gets approved the same way, and an export that fails halfway leaves a plan
that works.

The field mapping, how to find the MCP tools that raise items, and what to do
when either the tool or the destination is unknown are all in
[export.md](export.md). Read it only when `--tool` isn't `local` — a local run
has no use for the field tables of three trackers it will never write to.

### Approval, then handoff

Save to `./plans/YYYY-MM-DD-<feature>/` — `index.md` with `Plan status: draft`
and every milestone row `todo`, plus one `m<N>-<slug>.md` per milestone — then
ask.
Three things get surfaced at approval because they're the ones a user would want
to veto: **new dependencies** any ticket needs — including any the architect
_flagged_, since it never chooses one — the **model ceiling** — if a ticket is
rated above the session's own model, no tier exists to escalate to — and every
ticket whose **tier the estimator moved**, with what the bucket's record was.
List every ticket you proposed `Security sweep: ticket` for,
for the user to confirm or strike.
That last one is a judgement the user is better placed to make than either the
script or you: they know whether this ticket really is the same shape as the four
that went wrong, and it's their model spend.

Say here, too, what was **skipped**: the `grilling` round — installed-and-declined
or `--decisions auto` — `domain-modeling`, if it didn't run, the **architect**, if the skip condition held, and
`codebase-design`, if the architect reported it not loaded. None is a veto item;
they're the things at approval the user can't see from the
plan, and they change how hard they should read the acceptance criteria and a
`Contracts: none` respectively. With diagrams on, list what the artist drew and
declined, one line each.

On approval: set `Plan status: approved` and fill the **Commands** header from
the record, so the milestone gate still has the project's full build and test
commands in a session days later with no memory of this one.

Then the two handoffs, in this order — export first, because it's the one that
leaves the machine and the user should see it land before anything starts
changing code:

1. **`--tool` isn't `local`** → offer to raise the items now and do it on a yes,
   following [export.md](export.md). An outward-facing write gets its own
   confirmation; approving a plan is not the same act as publishing it into a
   team's tracker. Declined, the plan stands on its own and the export can
   be run later.
2. **Offer `qoq execute`** and run it on a yes. A repo planning its share of a
   feature offers nothing: it reports to the chief of staff,
   which starts execution. Never dispatch a ticket from
   here. The plan directory is the entire handoff, and folding execution in would put
   decomposition reasoning back into the context that has to run the plan.
