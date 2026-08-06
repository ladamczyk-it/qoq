# Execution — dispatch, gates, escalation, resume

Everything after a plan is approved. Load this at Phase 4 sign-off, or
immediately when the argument is a resume. Drafting a plan never needs it.

## Table of contents

- [Phase 5 — Execution loop](#phase-5--execution-loop)
- [Dispatching a wave in parallel](#dispatching-a-wave-in-parallel)
- [The dispatch prompt](#the-dispatch-prompt)
- [Retry budget and escalation](#retry-budget-and-escalation)
- [Ticket delivery gate](#ticket-delivery-gate)
- [Phase 6 — Milestone gate](#phase-6--milestone-gate)
- [Archiving a delivered milestone](#archiving-a-delivered-milestone)
- [Resume](#resume)

## Phase 5 — Execution loop

Work tickets in dependency order, in **waves**: at each step, take every
ticket whose dependencies are all `done` and whose files don't overlap another
ticket in the same wave, and dispatch the whole wave at once. Serial dispatch
is the exception, for a wave that genuinely holds one ticket — not the default
shape of the loop.

For every ticket in a wave:

1. Set **Status** to `in-progress` in the plan file.
2. **Dispatch to a subagent** via the Agent tool — every ticket, every
   complexity, no exceptions:
   - `subagent_type`: `general-purpose`.
   - `model`: the ticket's **Agent tier**. For a judgment-heavy ticket that
     is the model ID from your own system prompt, passed explicitly — not an
     omitted parameter, which resolves to the agent definition's own model
     before it falls back to yours.
   - Prompt: built per [The dispatch prompt](#the-dispatch-prompt).

   All of a wave's dispatches go in **one** message — see
   [Dispatching a wave in parallel](#dispatching-a-wave-in-parallel).

3. The subagent implements, then runs the ticket's
   [delivery gate](#ticket-delivery-gate) within its three-attempt budget.
4. **On PASS** — **Status** → `done`, advisories copied into the ticket's
   **Advisories** field, commit hash into **Commit**.
5. **On a handoff report** — re-dispatch one rung up per
   [Retry budget and escalation](#retry-budget-and-escalation). Never mark a
   ticket done without a `PASS`, and never loosen the gate to get one.

## Dispatching a wave in parallel

Two tickets with no dependency between them and no shared file have nothing to
serialize on. Running them one after another costs the plan real wall-clock
time for nothing — and a serial loop is also where the orchestrator starts
implementing: waiting on one subagent at a time makes "this next one is
trivial, I'll just do it here" feel efficient, and that's the failure this
whole workflow exists to prevent.

**A wave's Agent calls must all be in the same message.** Issued one per
message, they run one at a time no matter how independent they are — the
parallelism comes from batching the calls, not from the tickets being
independent. So: mark every ticket in the wave `in-progress`, then emit all its
Agent calls together, then handle the reports as they land.

Two constraints bound a wave, and only these two:

- **Dependencies.** A ticket joins the wave only when every ticket in its
  **Depends on** is already `done`.
- **Disjoint files.** No two tickets in one wave may name the same path in
  **Files**. There's no merge step here to reconcile two subagents editing the
  same file, and the loser's edits vanish silently. Overlap means the later
  ticket waits for the next wave.

Nothing else is a reason to hold a ticket back. Different tiers in one wave is
normal and fine — a `haiku` ticket and a judgment-heavy one dispatch side by
side. Wanting to "see how the first one goes" is not a constraint; that's what
the retry budget and the gate are for.

Mixed results within a wave don't stall the rest: each ticket's `PASS` is
recorded and each handoff report escalates on its own. A wave doesn't have a
collective verdict — only the milestone gate does.

## The dispatch prompt

A subagent starts cold with zero access to this conversation, the plan file,
or any other ticket. Anything it isn't handed, it invents. Build every
dispatch from:

1. The ticket's **Context**, **Files**, and **Acceptance criteria**, pasted
   verbatim. Never "see the plan" or "like Ticket 1.2" — those resolve to
   nothing on the other side.
2. The [delivery gate](#ticket-delivery-gate) steps as the definition of
   done, including the commit. An ungated or uncommitted ticket isn't
   delivered.
3. The retry budget, stated outright. This is the part that's easy to leave
   out and the whole reason the failsafe exists: a subagent never told it has
   three attempts and a way out will grind, or trim the ticket down to
   something it can pass. Give it explicit permission to stop:

   > You have three delivery attempts (implement/fix → run the gate). If the
   > gate still fails after the third, stop and reply with a handoff report
   > starting with the line "This feels too complex for me", followed by the
   > ticket id, attempts, what you tried, the verbatim blocker, and what
   > state you left on disk. Reply the same way immediately, without using
   > the attempts, if the ticket is missing context you need, contradicts the
   > codebase, or requires a decision that isn't yours to make. Reporting
   > back is the correct outcome in those cases — do not narrow the ticket's
   > scope or weaken the gate to produce a pass.

4. On a re-dispatch: the previous tier's handoff report, labelled as such, so
   the stronger model starts from what already didn't work.

## Retry budget and escalation

A cheap subagent that can't land a ticket is an expected outcome of cost
tiering, not an anomaly — starting at the cheapest capable tier means
sometimes it turns out not to be capable. A bounded budget and an honest
handoff are what make that cost one short run instead of a subagent looping
on a `FAIL` forever or quietly narrowing the ticket until something passes.

**Three delivery attempts.** One attempt is: implement (or fix), then run the
gate. Three `FAIL`s and the subagent stops and reports — no fourth try, no
asking the gate for a smaller scope.

**Escalate immediately, without spending the budget,** when the blocker isn't
"my code doesn't pass": missing context, an acceptance criterion that
contradicts the codebase, a design decision nobody made. Retries can't fix a
specification problem.

**The handoff report** takes this shape, so the orchestrator can act without
replaying the run:

```
This feels too complex for me.

Ticket: <id> — <title>
Attempts: <n>
What I tried: <one line per attempt — the approach, and how the gate answered>
Blocker: <the specific thing that kept failing; quote the qoq FAIL text verbatim>
State: <what's on disk now — files modified but uncommitted, or reverted clean>
```

The first line is what the orchestrator matches on; the rest keeps the next
tier out of the same dead end.

**The response is to re-dispatch one rung up** — same ticket, same acceptance
criteria, the `Escalates to` tier, and the handoff report pasted in. Record it
in the ticket's **Escalation** field. An escalation is information, not a
failure to hide: a ticket that needed a rung up was mis-rated, and writing
that down is how the next plan rates better.

**At the top rung there is no next tier**, because the top rung is the model
the user chose. A dispatch there that still burns its budget means one of two
things, both the user's call:

- **The ticket is wrong** — under-specified, too big, or resting on a
  decision that was never the implementer's to make. It needs respecifying or
  splitting, not another run.
- **The session's model isn't strong enough.** The fix is restarting the
  orchestrator on a stronger model and resuming.

Either way: **Status** → `blocked`, bring the user the handoff report plus
which of the two you think it is. Don't finish it on the main thread — that's
the same model that just failed, now burning the orchestrator's context and
hiding a planning defect that will recur in the next plan.

## Ticket delivery gate

Not a new contract — `qoq`'s own, applied with an explicit file list every
time, because a ticket's implementer always knows exactly what it touched.

1. **Only if the ticket creates or edits test files** — run `testing-gate`
   over them (it writes the tests and, as its own last phase, gates itself
   through `qoq`). A ticket whose **Files** lists no `Test:` entry skips this
   entirely: `testing-gate` writes tests, so invoking it on a ticket not
   meant to produce any burns a subagent inventing coverage nobody asked for
   and widens the diff past what was sized and approved.
2. Run `qoq gate <the files touched>` — the explicit list from **Files**,
   never an inferred or dirty-tree scope. Per
   [qoq's contract](../../qoq/SKILL.md#consuming-qoq-from-another-skill):

   > Run `/qoq gate <the files you changed>` and wait for its verdict. If it
   > returns `FAIL`, fix the reported blockers and re-run it. Only declare
   > the task complete on `PASS`; pass along any advisories it reported.

3. React exactly as that says. `PASS` → done, advisories ride along into the
   ticket's notes, never dropped silently. `FAIL` → fix and re-gate within
   the three-attempt budget; on the third, hand off rather than marking done
   or weakening the gate.
4. On `PASS`, commit exactly the files in **Files** — `git add <those paths>`
   then `git commit -m "<ticket id>: <ticket title>"` — and capture the hash
   (`git rev-parse HEAD`). A `PASS` left uncommitted is an untracked promise
   the next ticket's dependencies, or a future resume, can't build on.

**Commit link.** If `git remote get-url origin` resolves to github.com,
gitlab.com, or bitbucket.org, format **Commit** as
`[<short-hash>](<https-url>/commit/<hash>)` — strip a trailing `.git` and
convert `ssh://`/`git@` to `https://` first. No remote, or an unrecognized
host: record the bare hash rather than guessing a URL.

## Phase 6 — Milestone gate

Once every ticket in a milestone is `done`, run the full quality suite as its
own phase — deliberately broader than any ticket's gate, to catch integration
issues between tickets that individually passed:

1. `qoq gate` with **no explicit paths**, so it infers scope from everything
   dirty in the milestone rather than one ticket's files.
2. The project's **full** build and test commands from Phase 1's discovery —
   not the scoped single-file commands the ticket gates used.

**Delegate this run too.** A full build and test suite emits thousands of
lines the orchestrator has no use for once it knows the verdict, and it's the
orchestrator's context that has to survive the rest of the plan. Dispatch one
subagent at the cheapest tier — this is running commands, not judgment — and
ask for the verdict plus the verbatim failures only, with no fixes attempted:

> Run `qoq gate` with no path arguments, then `<full build command>` and
> `<full test command>`. Make no edits and fix nothing. Reply with each
> command's pass/fail and, for anything that failed, the verbatim error output
> and the files it names.

Both green → delivered; archive before starting the next milestone. Either
red → write the failure up as a new ticket in the milestone (sized, rated,
tiered like any other) and dispatch it. An integration failure between two
passing tickets is real work with a real diff; routing it through the same
dispatch-gate-commit path keeps it reviewable and the milestone's history
honest about what it took to land.

## Archiving a delivered milestone

A delivered milestone's tickets are finished history — their Context and
acceptance criteria briefed subagents that will never be dispatched again.
Left inline, every later status check and resume pays for the whole backlog,
and the orchestrator's attention is the one resource here that doesn't scale.
The plan should read as "what's left."

On delivery, move the milestone's full text to
`./plans/<same-plan-name>.completed.md` (create at the first archive, append
after) and leave a summary block under a `## Completed` section at the top of
the plan. Both shapes are in [plan-template.md](plan-template.md).

**That summary is for the orchestrator; no subagent will ever read it.** When
delivery established something a later ticket depends on — a real exported
name, a signature that shifted, a file that landed elsewhere than planned —
edit that into the downstream tickets' **Context** fields _first_, then write
the summary. A decision recorded only under `## Completed` is invisible to
the cold subagent that needs it: the same failure Phase 3's consistency check
prevents, arriving a milestone later.

Keep the summary to a few lines. If it's becoming a design document, that's
what the archive file is for — the plan gets shorter as work lands, not
longer.

## Resume

The plan file's **Status** fields (plan-level and per-ticket) are the source
of truth, including across sessions.

- Read the plan file fresh rather than trusting memory of an earlier session.
- Skip every `done` ticket — don't re-decide its scope or re-run its gate.
- Treat `## Completed` summaries as sufficient. Don't open
  `<plan-name>.completed.md` to "get up to speed" — archiving it is precisely
  what keeps a resume from costing the whole history. Read it only for a
  specific question the summary can't answer, like tracing a regression back
  to the ticket that introduced it.
- Pick up `todo` and `blocked` tickets in dependency-ordered waves, the same
  as a fresh run — a resume that has three unblocked tickets left dispatches
  all three at once. But dispatch a
  `blocked` ticket whose **Escalation** field is already filled at the tier
  it escalated _to_, not the tier that failed. Re-running that rung is the
  one thing already known not to work.

A resume enters at [Phase 5](#phase-5--execution-loop) directly. Discovery,
the scope check, and decomposition don't re-run against an approved plan.
