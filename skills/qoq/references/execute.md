# `qoq execute` — an approved plan in, delivered milestones out

Run a plan to completion by dispatching every ticket to a `qoq-developer` at the
tier the plan already assigned. This command **never implements anything
itself** — its whole job is dispatch, gates, status, and recording delivery.

## Contents

- [Where the plan comes from — `--source`](#where-the-plan-comes-from----source)
- [Loading and resuming](#loading-and-resuming)
- [One ticket at a time](#one-ticket-at-a-time)
- [Spending limits, when the user asks for them](#spending-limits-when-the-user-asks-for-them)
- [The dispatch](#the-dispatch)
- [The ticket is red → green; refactoring is the milestone's](#the-ticket-is-red--green-refactoring-is-the-milestones)
- [Report the outcome back, once per ticket](#report-the-outcome-back-once-per-ticket)
- [Escalation](#escalation)
- [The milestone gate](#the-milestone-gate)
- [When the last milestone is delivered](#when-the-last-milestone-is-delivered)
- [Setup](#setup)

## Where the plan comes from — `--source`

`--source local` is the default and needs nothing: a plan directory
(`plans/<plan>/`, or its `index.md`), or the single approved plan under
`./plans/` when the argument is omitted.

**A plan is a directory.** A bare `plans/<name>.md` is the single-file layout
from before this version, and nothing here reads it: say so in one line, name
the file, and stop. It isn't converted for the user — a delivered one is
history as it stands, and a live one is re-planned with `qoq plan`.

**The three trackers are experimental**, on the same per-project switch as
`plan --tool` ([plan.md](plan.md)): `future.unstable_skill_plan_<tool>: true` in
`qoq.config`, grepped as source text. Check it first. Switch off is a one-line
stop naming it, before anything is asked or read from the tracker; the flag
alone never turns it on.

`--source jira|linear|trello` asks which milestone to run, reads it and its
tickets into a plan directory, and then continues here as if it had always
existed — [references/export.md](export.md) owns that beat, including the two
places it stops. **Read it before anything else on a non-local source**; nothing
below this section knows or cares where the tickets came from, which is the
whole point of importing rather than executing against a tracker.

One thing from there reaches into the loop below: on an imported plan, a ticket
arriving at `done` or `blocked` also writes its status label and commit back to
the tracker. That is the only write, and it's a label, never a workflow column.

## Loading and resuming

**Load the plan fresh from disk every time**, resume or not. The files are the
state — an in-memory copy from earlier in the session goes stale the moment a
ticket writes its commit hash back.

Read `index.md` first: its header and its **Milestones** table, which says which
milestone is next — the first row neither `delivered` nor `withdrawn` whose
**Depends on** rows are all `delivered`. Then read **that milestone's file and
nothing else of the plan**. A delivered milestone's file is history, and a later
one's tickets are not this run's business until their turn; what an earlier
milestone established reaches them through their own **Context**, written at
delivery. The one exception is the end-of-plan pass, which reads every
milestone's **Outcome** block.

**A plan with a `Feature` header line** is one repo's share of a
feature ([plan.md](plan.md#planning-a-repos-share-of-a-feature)). The
cross-repo answer comes from
`node <skill>/scripts/feature-status.mjs --root .. --feature <slug>`.
Its `next` entry for this repo is the next milestone, and the script treats a
`<repo>:M<N>` dependency, and a master milestone that hasn't passed
integration yet, the same way as any other dependency that isn't delivered.
When `next.runnable` is false, stop at that milestone boundary and report what
`waitingOn` lists. That's a normal pause, not a blocked ticket. Every question
this run would ask the user goes to the chief of staff named in the launch
prompt, using `SendMessage`. So does a one-line report after every ticket
commit, every milestone gate and every stop. Write to the plan file before you
send it. Nobody reads this session's final text, so never end a turn without
that message.

A ticket sitting at `in-progress` means a previous run died mid-flight.
Reconcile against `git log`: if the ticket's files were committed, mark it
`done`; otherwise re-dispatch it. Don't ask the user to remember what happened.

**A plan directory outside this session's project** (`$CLAUDE_PROJECT_DIR`)
belongs to another repo. Name it, say to run `execute` from a session opened in
that repo, and stop. Every agent's guard confines it to this project, so each
gate there would be refused.

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
- the **paths to `references/test-conventions.md` and
  `references/code-conventions.md`** in this skill — a subagent has no way to
  work out where the skill lives
- the **model** for the ticket's tier, passed explicitly
- the three-attempt budget, with explicit permission to hand the ticket back
  rather than narrow it
- after a failed gate, **resume** the developer (SKILL.md) with the **digest or
  the verdict verbatim** plus which attempt this is. A fresh re-dispatch carries
  the full brief, and pastes the last return in whole too

**Not the milestone's `Scenarios`.** Those are journey-level and a ticket is not
— they'd be context the developer can't act on, and the one thing worse than
missing context is context that invites work outside the `Files` list.

Write the ticket's **`Log`** at each transition — dispatch, each gate verdict,
each re-dispatch (`resumed` or `fresh`), `done` or `blocked` with the hash. It's orchestrator-written
because only this thread sees the transitions: `Status` says where a ticket
ended, and the `Log` is the only thing that says how it got there.

**Every failure line names its gate, its category and its evidence**:
`qoq fix FAIL — convention — no-restricted-imports src/api.ts:12`. The milestone
retro reads nothing but these lines, and "FAIL" alone gives it nothing to learn
from. [retro.md](retro.md) owns the category list and what to do with a handoff
that arrives without one.

## The ticket is red → green; refactoring is the milestone's

**The ticket runs `tdd`'s loop**: one acceptance criterion at a time, a failing
assertion proved red, then the minimum that turns it green, then the next. The
milestone's `Contracts` and the ticket's criteria are the pre-agreed seams `tdd`
requires — the user approved them with the plan, so nothing is asked again here.

**Refactoring is not in the ticket.** `tdd` puts it in review, and here review is
the milestone: `qoq refactor --decisions auto` over every file the milestone's
tickets touched — the first moment those tickets exist as one piece of code, and
the only scope where duplication across four tickets, a now-dead export, or three
tickets that each picked a different shape is visible at all.

There is no per-ticket standards pass and no complexity-driven routing table: a
`trivial` ticket and a `judgment-heavy` one run identical steps at different
tiers.

### Two gates per ticket, in this order

```
developer hands back → qoq fix --skip-knip (scoped) → qoq-test-reviewer → commit
```

Read the block the developer's return ends on (`agents/qoq-developer.md`).
`status: handoff` runs neither gate. With `blocker_kind: model` it goes straight
to **Escalation**, and so does a return with no block, such as a `maxTurns` stop.
With `blocker_kind: plan` it doesn't escalate, because the blocker is in the
ticket and no tier is allowed to change the ticket. Bring the user the `blocker`
verbatim and ask what the plan should say. Leave the ticket `in-progress` and
write a Log line. Edit the plan only with the user's answer. Then re-dispatch at
the ticket's own tier with a fresh three-attempt budget: it is a different
ticket now. File its estimate as `scope-expansion`, since the ticket that got
built isn't the one that was estimated.

**Gate 1 — `qoq fix --skip-knip`, scoped** to the developer's `files`, spec and
source both. Scoped, because the verdict has to be about this ticket and nothing
else.

**Knip is off here, and it's the only tool that is.** Scoping the others is just
reading the digest for the ticket's files; Knip can't be scoped that way, because
what it answers — is this export reachable — is computed from the whole repo, and
mid-milestone that repo is missing every ticket after this one. An export ticket 4
consumes is unreachable while ticket 3 is the newest code on disk, so Knip reports
it, the gate FAILs, and the fix the developer is sent back to make is deleting the
thing the plan told it to build. The finding isn't early; it's false.

That's true of the developer's own scoped run too, which is why it uses
`ticket_scoped`. Everything else — Prettier, ESLint, JSCPD, the rest — is a
property of the file in front of it and stays on.

**Gate 2 — `qoq-test-reviewer`**, read-only, over the developer's `specs`. Its
dispatch carries those files, the ticket's acceptance criteria, the milestone's
`Contracts`, and the path to `references/test-conventions.md`.

**A ticket with `Security sweep: ticket`** gets one more read after Gate 2: an
early `qoq-sheriff` sweep over its own diff, before
the commit. What it finds and what that costs the ticket is
[sheriff.md](sheriff.md)'s.

**`qoq fix` runs first because it rewrites formatting**, and there's no point
spending a semantic read on text that's about to change.

**Gate 2 sits before the commit, and that is the whole argument for its cost.** A
ticket marked `done` whose tests assert nothing isn't a deferred problem — it's a
false statement this file then propagates: a `success` filed with the estimator,
downstream tickets built on a behaviour nothing pins, and an Outcome block
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

**The commit body quotes every `comments_removed` entry** — location, the
comment verbatim, the reason. A comment that predates the ticket may be the only
record of a decision ([code-conventions.md](code-conventions.md)); once it leaves
the code, the commit is the only place left that holds it.

### The commit passes `--no-verify` — and so does any push

`git commit --no-verify` on every ticket, because the two gates above **are** the
verification, run over exactly this ticket's files a moment earlier. A project's
`pre-commit` hook re-runs the same tools over the same diff for the same
findings, once per ticket, for nothing.

It's worse than redundant when the hook runs the project's own full check,
because that check runs Knip — the one tool Gate 1 deliberately drops, for the
reason above. Mid-milestone the hook asks whether ticket 4's dependency is
reachable in a tree where ticket 4 doesn't exist yet, answers no, and blocks the
commit on a finding that isn't true. `--skip-knip` in the gate and a verifying
commit right after it cancel each other out.

None of this skips the unscoped check; it moves it to the milestone gate, where
`qoq fix` runs with Knip on over the union of every ticket's files, alongside the
project's full build and suite. That's the beat where a hook's answer would have
been true, and it already runs there — which is why a push, if the user asks for
one after the milestone gate is green, carries `--no-verify` too rather than
paying for that suite a second time.

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

Without it a delivered plan reads identically to an undelivered one. The
developer's `advisories` go on the ticket's **Advisories** line.

### The test cycle stays the developer's own

Never dispatch `qoq test` or a `qoq-tester` for a ticket's specs: the developer
writes each criterion's assertion itself, and `qoq-developer.md` says why. Gate 2
is the independent check on what it wrote.

## Report the outcome back, once per ticket

The moment a ticket reaches `done` or `blocked`, tell the estimator how its call
turned out — this is the only place in the system that knows, and a plan
approved next week is estimated from it:

```bash
node <skill>/scripts/estimate.mjs --record --tags <the ticket's tags> \
  --stack <the ticket's stack> --tier <the tier the plan assigned> \
  --outcome success|failure --attempts <n> \
  --attribution as-estimated|scope-expansion --summary "<the ticket title>"
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

- `as-estimated` — the ticket was what the plan said it was, so the estimate is
  graded on it. This is the value for a clean first-try `done` too: it counts as
  a miss only on `failure` or after more attempts than the budget.
- `scope-expansion` — the developer found work nobody knew was there: a
  migration nothing mentioned, a broken assumption upstream. The ticket that got
  built isn't the ticket that got estimated, so grading the estimate on it
  teaches the next plan a lie. It's counted separately and never touches the
  mean.

When it's genuinely both, call it `scope-expansion`. A false miss quietly
degrades every future estimate for that combination; a missed one costs a single
data point.

## Escalation

A dispatch that fails because the tier's model doesn't resolve isn't an
attempt. Don't count it, don't record it with `estimate.mjs`, and don't escalate:
nothing about the ticket was tested. Stop at that ticket and follow SKILL.md's
rule for a tier that doesn't resolve. Once the user has mapped it, re-dispatch at
the same tier. If they decline, stop.

Three attempts spent across both gates, or a `model` handoff at any attempt,
exhausts the ticket at that tier. A `plan` handoff never gets here. Dispatch a
fresh agent one tier up with the last return pasted in whole — its `blocker` verbatim on a
handoff — plus the last digest or verdict;
it's the most useful context the next attempt can have. Record the escalation on
the ticket even when the escalated run then passes: it's how a resume knows not
to retry the tier that already failed, and how the user sees which tickets were
mis-rated.

At the top rung there's nowhere to escalate to. Mark the ticket `blocked` and
bring the user the report. Two things it could mean, and the report usually says
which: the ticket is bad, or the session's own model is too small for it.

## The milestone gate

When every ticket in a milestone is `done` or `blocked`:

1. `qoq refactor --decisions auto <union of every ticket's files>` — the whole
   [refactor.md](refactor.md) procedure, not a reading of the files: its green
   base, then assessments 1–4 in order, `qoq-designer` dispatched for the
   fourth. A lead that reads the union itself and calls it clean has skipped
   the gate. `--decisions auto` because nobody is watching — the safe tier is applied and
   everything shape-changing comes back as an advisory. The specs are in that
   union, so cross-ticket spec problems — duplicated setup across four tickets,
   one boundary mocked three ways — are already assessments 2–4's job. JSCPD
   skips spec files by default, so assessment 1 never sees them. No third gate is
   needed here.
2. The project's **full** build and test suite from the record — not the scoped
   variants a ticket gate uses.

**This is where Knip runs, in full, and it is the first moment its answer is
true.** Its green base is a plain `qoq fix` over the union — no `--skip-knip`,
because every ticket that was going to consume an export now exists. What it
reports here is real dead code: something a ticket built and nothing consumed, or
an export left behind by a shape that changed halfway through. Deferring it costs
one milestone of dead code sitting in the tree, and buys back every ticket that
would otherwise have been sent round the loop to delete work it was told to
write.

Red → write the failure up as a new ticket: sized, rated, dispatched like any
other. Don't patch it on this thread; the lead doesn't implement.

Green → **sheriff**, always. `qoq-sheriff` sweeps the
milestone's combined diff for logic-level security problems, and its findings
are routed, remediated or recorded before anything below runs —
[sheriff.md](sheriff.md) owns all of it, including the two places it stops the
run.

Then **review**, always. `qoq-reviewer` reads the milestone's
final diff, security fixes included, on two parallel axes. Spec checks it
against its Goal, Contracts and criteria for wrong turns, scope creep and
cross-ticket inconsistency. Standards checks it against the project's
conventions and `code-review`'s smell baseline. Its findings are
routed, remediated or recorded before anything below runs.
[review.md](review.md) owns all of it, including the two places where it stops
the run.

Then **document**, when docs are on (Setup), then **deliver**. `qoq-scribe`
runs in plan mode over the milestone — [document.md](document.md) owns how,
followed by `qoq-artist` when diagrams are on too ([mermaid.md](mermaid.md)) — and
its `docs(m<N>)` commit lands before the Outcome block is written, because the
milestone file as the gate left it is its input. Docs off → straight to
delivery, no Docs advisories line. It never stops the run: a question or a
finding becomes a **Docs advisory** in the Outcome block, walked through with
the user at the end of the run.

Then **retro**, when any ticket in the milestone took more than one attempt,
escalated or ended `blocked`. `qoq-retro` reads the milestone file's Logs and
returns lessons, which go into the milestone file as its `## Retro` section
before the Outcome block is written. It never stops the run and changes nothing
yet. [retro.md](retro.md) owns all of it. No retries → straight on, no Retro
line.

Then **deliver**. Nothing moves: the milestone file stays where it is.

1. Write its **Outcome** block at the top of the milestone file, above
   **Scope** ([../assets/plan-template.md](../assets/plan-template.md)). Gate
   advisories go into it; one that never reaches the Outcome block is as lost
   as one never looked for.
2. Set the milestone's index row to `delivered <YYYY-MM-DD>`, with the
   **Delivered** sentence as its Summary.
3. Update later milestone files' ticket **Context** with anything this
   milestone established, while it's still in front of you. A later milestone's
   run reads only its own file, so a decision this one made reaches it here or
   not at all.

The milestone row goes `in-progress` when its first ticket dispatches, and the
plan's status goes `complete` with the last row delivered.

**Record what the gates proved, not that they ran.** The Outcome block's **Gate
evidence** field takes the refactor's verdict and the suite's result as reported,
plus the sheriff's and the reviewer's verdicts, and the retro's
lesson count on the **Retro** line when it ran.
"Green" is a claim; "refactor clean, 412 passed / 0 failed" is evidence, and an
Outcome block is read by people who can no longer see the run.

## When the last milestone is delivered

In this order:

0. **The final retro**, when any milestone had one. It merges the milestone
   retros into the index's `## Retro` section, even when there was only one
   to merge, and records the planning and skill lessons without asking. Code
   lessons are the one question: on a yes, one follow-up milestone is appended
   to this plan and run before anything below.
   [retro.md](retro.md) owns it, including why there's never a second follow-up.
1. **The end-of-plan review, then its gap decisions.**
   [review.md](review.md) covers both, and also when the pass is skipped.
2. **The advisory walkthrough**, once: every milestone's Refactor, Docs,
   Security and Review advisories, each with its own options. Refactor
   advisories are the milestone gate's judgement-tier findings — with no
   refactor beat in the ticket, they are the only place a shape problem in
   delivered code reaches the user, so they're walked through even on a run
   with every experimental flag off.
3. **The sign-off.** The summary from [review.md](review.md), and the user's
   yes written into the plan header.

## Setup

**`tdd` first — the base every spec in this run is written against.** Is it in
your own available-skills list, under any name? Not there → **stop**, even if
its files are on disk: a disabled plugin stays in the cache, and the list is the
only thing that knows it's off. The developer and test-reviewer list `tdd` in
their `skills:` frontmatter, so Claude Code preloads it into them — but an agent
whose `skills:` entry doesn't resolve starts without it and says nothing, which
is why this check can't be skipped.

**Don't invoke `tdd` here**: its instructions are for whoever writes the test,
and loaded into this thread they pull it into writing the specs itself instead
of dispatching. The stop has no proceed-without:

> `tdd` isn't installed, and every spec this run writes is built on it. It
> normally arrives with qoq as a plugin dependency; install it with
> `/plugin install mattpocock-skills`, then `/qoq execute` again.

Then two checks: are `qoq-developer`, `qoq-test-reviewer`, `qoq-sheriff` and
`qoq-retro` and `qoq-reviewer` registered under
`.claude/agents/`? If one isn't, dispatch `general-purpose` with that agent
file's body pasted in and told to invoke `tdd` with the Skill tool first, since
`general-purpose` preloads nothing — for the developer, with the tier passed explicitly, since
`general-purpose` otherwise inherits the session's model and quietly overrides
the rating the plan made; for the ones that report, with the read-only prohibition
restated, since `general-purpose` gets every tool and would arrive holding the
ability to fix what it was dispatched to report.

**Docs are experimental and off by default.** They're on only when the run was
invoked with `--docs`, or when the project's `qoq.config.*` sets
`future: { unstable_skill_docs: true }` — one Grep for
`unstable_skill_docs\s*:\s*true` over the config file, read as source text and
never evaluated. Decide it once here and say which in the run's opening line.
**The sheriff** isn't a switch. It runs at every milestone gate and on every
`Security sweep: ticket` ([sheriff.md](sheriff.md)). **The review** isn't a switch
either. It runs at the milestone gate after the sheriff, and again once at the
end of the plan ([review.md](review.md)).
**Diagrams** are the same kind of switch — `--diagrams`, or
`future.unstable_skill_diagrams: true` — and need docs on to do anything
([mermaid.md](mermaid.md)).

Commands come from the record. The plan's **Commands** header is a convenience
copy for a session that has one and not the other — there's no `package.json`
fallback, because discovery has already run before the first ticket dispatches.
