---
name: execution-gate
description: >-
  Executes an approved implementation plan under `./plans/` by dispatching
  every ticket to a subagent at the tier the plan already assigned, in parallel
  waves by default, each delivery gated through QoQ's `gate` command (plus
  `testing-gate` on test-only tickets) and committed before it counts as
  done. Owns the whole post-approval half: wave dispatch, the three-attempt
  retry budget, escalation one tier up on a handoff report, the per-ticket and
  per-milestone gates, archiving delivered milestones, and resuming a plan
  across sessions. Use whenever a plan file exists and the user wants it built
  — "execute the plan", "start building this", "run the tickets", "dispatch
  milestone 2", "resume ./plans/<file>.md", "pick up where we left off", "close
  out this milestone" — even if they don't say "execution-gate" or name
  qoq/testing-gate explicitly. Also use immediately after `planning-gate`
  produces an approved plan.
argument-hint: '<./plans/file.md> [--parallelism wave|linear]'
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Skill
  - Agent
  - Bash(ls:*)
  - Bash(git status:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git diff:*)
  - Bash(git log:*)
  - Bash(git rev-parse:*)
  - Bash(git remote:*)
  - Bash(git switch:*)
  - Bash(git branch:*)
  - Bash(npm run:*)
  - Bash(npm test:*)
  - Bash(yarn:*)
  - Bash(pnpm:*)
metadata:
  version: 0.1.0
---

Takes an approved plan file and delivers it: every ticket dispatched to a
subagent at the tier the plan already assigned, gated, committed, and marked
done — never a to-do list someone works through by hand.

**You are the lead. The lead orchestrates; it never implements.** Every
ticket goes to a subagent under a bounded retry budget, and independent tickets
go out together, not one per turn. Keep on this thread only what belongs here —
reading escalations, approving dependencies, updating the plan file, talking to
the user — and delegate the typing, the reading, and the command output. A
subagent's context is disposable; yours holds the whole plan.

**This skill consumes a plan; it does not write one.** Sizing, complexity
ratings, tiers, and ticket Context all arrive already decided by
[`planning-gate`](../planning-gate/SKILL.md). If a ticket turns out to be
under-specified, that's a planning defect to hand back — not something to
quietly redesign here.

**It doesn't define quality either.** `qoq` and `testing-gate` are consumed on
their own published terms. This skill's job ends at "every ticket in the
milestone is gated, committed, and archived."

## When to use it

Whenever an approved plan exists and work should start or continue: a fresh
plan just signed off, a half-finished plan being resumed in a new session, a
single milestone to close out.

Don't reach for it without a plan file. Ad-hoc work that was never decomposed
goes straight to the code with `qoq gate` on delivery — the dispatch machinery
here only pays off when there are tickets to dispatch. And if the plan file
holds exactly one ticket, just do that ticket.

## Setup check

- **`qoq`** gates every ticket. Confirm it's in your available-skills listing
  before dispatching anything. Missing → stop and tell the user it needs
  installing; don't dispatch tickets with the gate step quietly dropped, and
  don't install it yourself.
- **`testing-gate`** is only needed if some ticket is test-only — its **Files**
  lists nothing but `Test:` entries. Missing when one exists → say so and ask
  whether to proceed without it, rather than deciding for the user.
- **The bundled agents** ([agents/](agents/)) are dispatched as
  `subagent_type: plan-developer` / `plan-tester`. They ship registered — the
  plugin publishes them, and this repo symlinks them into `.claude/agents/` —
  so check your available agent types once, up front, rather than deciding per
  dispatch.

  If they aren't there, fall back to `general-purpose` with the agent file's
  body pasted at the top of the prompt. That works, but it isn't free: it's
  ~150 lines re-sent on every dispatch and every retry, so a wave of six
  tickets pays for it six times. Worth telling the user the agents aren't
  registered and that installing the plugin properly would cut the run's cost.

## Parallelism

Two modes, chosen by the `--parallelism` argument:

| Mode               | Behavior                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `wave` _(default)_ | Every eligible ticket dispatches together in one message. Fastest; the shape the plan was written for.        |
| `linear`           | One ticket at a time, in dependency then plan order. Still dispatched to a subagent — never implemented here. |

`wave` is the default because a plan's tickets were decomposed to be
independent, and dispatching them one per turn multiplies wall-clock time by
the wave size for nothing.

Pick `linear` deliberately, for reasons that are real: watching the first
tickets land before committing the rest, an API rate limit, a repo where you
don't trust the **Files** lists enough to believe two tickets are disjoint, or
a debugging session where interleaved subagent output is unreadable. It costs
wall-clock time proportional to the wave size — an honest trade, not a safer
default.

**`linear` changes only how many dispatches are in flight.** Everything else
holds: tickets still go to subagents, still carry the three-attempt budget,
still gate and commit, still escalate on handoff. It is not permission to
implement a ticket on this thread, and it is not a checkpoint that waits for
user approval between tickets — report each verdict in one line as it lands and
keep going, unless the user asked to be consulted.

If the argument is absent, use `wave`. If the user describes the constraint
rather than naming the flag ("go one at a time", "I want to see each one"),
that's `linear`.

## Phase 1 — Load the plan

Read the plan file fresh from disk, in full, every time — including on a resume
in the same session. Memory of what it said is exactly what a stale plan file
looks like, and the plan is the source of truth for status across sessions.

Take from it:

- **Plan status.** `draft` means it was never approved: stop and route the user
  back to `planning-gate` rather than executing an unapproved plan.
- **Every ticket's Status**, to know what's already `done` (skip it — don't
  re-decide its scope or re-run its gate), what's `todo`, what's `blocked`, and
  what's `in-progress`.

  **`in-progress` on load means a previous run died mid-flight**, because the
  status is set at dispatch and overwritten the moment the subagent reports.
  Nobody is working that ticket now. Treat it as `todo` — but check first
  whether its subagent got further than the plan records, since it may have
  gated and committed in the seconds before the session ended:

  ```bash
  git log --oneline -1 -- <the ticket's Files>
  ```

  A commit whose message starts with the ticket id means it landed: fill in
  **Commit**, set **Status** to `done`, move on. Anything else — no commit,
  or a commit from a different ticket — means re-dispatch it, after
  `git status` on those paths to see whether half-finished edits are sitting
  there. Say what you found either way; a ticket that quietly reverted is
  something the user should hear about.

  Leaving `in-progress` out of the resume is the failure this guards against:
  the ticket is never dispatched again and never reported, and the milestone
  gate then runs over work that was never delivered.

- **Commands**, from the plan header — the project's full build and test
  commands, needed by the milestone gate. Older plans may not carry the field;
  then read the root `package.json` scripts yourself. That's one Read, not a
  delegation.
- **`## Completed` summaries**, as sufficient. Don't open
  `<plan-name>.completed.md` to "get up to speed" — archiving it is precisely
  what keeps a resume from costing the whole history. Read it only for a
  specific question the summary can't answer, like tracing a regression back to
  the ticket that introduced it.

Nothing else re-runs: no repo discovery, no re-decomposition, no re-rating. An
approved plan already holds those decisions.

**Check the branch once, before the first dispatch.** A plan is dozens of
commits landing unattended; `git rev-parse --abbrev-ref HEAD` on `main`,
`master`, or the repo's default means they land straight on it, and there is no
review surface left afterward. If that's where you are, say so and offer a
branch (`plan/<plan-file-basename>`) before dispatching. Take the user's answer
either way — some repos genuinely work trunk-based — but ask before the first
commit, not after thirty. On a resume, whatever branch the plan started on is
the one to continue on; don't create a second.

## Phase 2 — Execution loop

Work tickets in dependency order. At each step, take every ticket whose
dependencies are all `done` and whose files don't overlap another ticket in the
same wave — that's the wave. Under `linear`, take the first such ticket only.

For every ticket dispatched:

1. Set **Status** to `in-progress` in the plan file.
2. **Dispatch to a subagent** via the Agent tool — every ticket, every
   complexity, no exceptions:
   - `subagent_type`: `plan-tester` if the ticket's **Files** lists _only_
     `Test:` entries; `plan-developer` otherwise. Falling back to
     `general-purpose` when they aren't registered, per the setup check.
   - `model`: the ticket's **Agent tier**, passed explicitly. For a
     judgment-heavy ticket that's the model ID from your own system prompt —
     not an omitted parameter, which resolves to the agent definition's own
     model before it falls back to yours.
   - Prompt: built per [The dispatch prompt](#the-dispatch-prompt).

   Under `wave`, all of a wave's dispatches go in **one** message — see
   [Dispatching a wave](#dispatching-a-wave).

3. The subagent implements, then runs the ticket's
   [delivery gate](#ticket-delivery-gate) within its three-attempt budget.
4. **On PASS** — **Status** → `done`, advisories copied into the ticket's
   **Advisories** field, commit hash into **Commit**.
5. **On a handoff report** — re-dispatch one rung up per
   [Retry budget and escalation](#retry-budget-and-escalation). Never mark a
   ticket done without a `PASS`, and never loosen the gate to get one.

### Developer or tester

The choice is about what the ticket produces, and it's a one-line read of
**Files**:

- **Only `Test:` entries** → `plan-tester`. Writing the tests _is_ the
  deliverable, for code that already exists — which is exactly what
  `testing-gate` does, so `plan-tester` delegates to it.
- **Anything else** → `plan-developer`, even when the ticket also has a `Test:`
  entry. A ticket that ships a feature plus its tests is one coherent piece of
  work; splitting it across two subagents means the tests get written against a
  guess at an implementation that isn't written yet. `plan-developer` writes
  those tests as part of the change and gates the whole ticket through `qoq`
  — it doesn't invoke `testing-gate`, which exists to author coverage against
  finished code, not to second-guess tests shipping with their own feature.

**This is the common case, so the standards can't only live behind the skill.**
Most tickets ship a feature with its tests, which means `plan-developer` writes
the bulk of a plan's test code and `testing-gate` is dispatched rarely. What
makes that acceptable is that the rulebook is a plain reference —
[`testing-gate/references/conventions.md`](../testing-gate/references/conventions.md),
readable standalone — and `plan-developer` reads it whenever its **Files** has
a `Test:` entry. Same conventions, one Read instead of a second subagent. If
the two ever diverge, that file is the one that's right.

## Dispatching a wave

Two tickets with no dependency between them and no shared file have nothing to
serialize on. Running them one after another costs the plan real wall-clock
time for nothing — and a serial loop is also where the lead starts
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

### What a wave shares, and what it must not

The subagents run against one working tree, one git index, and one `.qoq/`
workspace. Three consequences the dispatch has to account for, because none of
them announce themselves — they surface as an inexplicable `FAIL` in a ticket
that did nothing wrong:

- **Every `qoq` call carries `--run <ticket id>`.** That's the flag that gives
  each ticket its own `.qoq/runs/<id>/` scratch directory
  ([qoq's workspace](../qoq/references/workflow.md#the-workspace--qoq)). Without
  it the whole wave shares `.qoq/runs/default/`, and the first ticket to finish
  deletes the snapshots the others still need to undo a bad fix — losing
  uncommitted work with no error. Pass it on every dispatch; it costs one field
  in the prompt.
- **Whole-project validation is not the ticket's verdict.** `qoq --check`, the
  build, and the test suite all run repo-wide, so a wave-mate's half-written
  file makes them red in a ticket that never touched it. The dispatch prompt
  says so outright, because a subagent that doesn't know this burns its whole
  retry budget on someone else's file and then escalates: **failures naming
  files outside your Files list are not yours — report them, don't fix them,
  and don't count them against your attempts.**
- **`git commit` serializes.** Two subagents committing at the same moment
  collide on `index.lock`; the loser sees `Unable to create index.lock: File
exists`. That's transient — retrying the commit after a moment works, and it
  is not a delivery failure. Say so in the dispatch so nobody reports a
  successful ticket as blocked over a lock file.

Nothing else is a reason to hold a ticket back. Different tiers in one wave is
normal and fine — a `haiku` ticket and a judgment-heavy one dispatch side by
side. Wanting to "see how the first one goes" is not a constraint; that's what
the retry budget and the gate are for, and it's what `--parallelism linear` is
for if the user genuinely wants it.

Mixed results within a wave don't stall the rest: each ticket's `PASS` is
recorded and each handoff report escalates on its own. A wave doesn't have a
collective verdict — only the milestone gate does.

## The dispatch prompt

A subagent starts cold with zero access to this conversation, the plan file, or
any other ticket. Anything it isn't handed, it invents. Build every dispatch
from:

1. The ticket's **id and title**, then its **Context**, **Files**, and
   **Acceptance criteria**, pasted verbatim. Never "see the plan" or "like
   Ticket 1.2" — those resolve to nothing on the other side.

   The id doubles as the subagent's `--run` value, so state it as such: _"Pass
   `--run <ticket id>` to every `qoq` command."_ Under `wave` also paste the
   two shared-tree facts from
   [What a wave shares](#what-a-wave-shares-and-what-it-must-not) — foreign
   validation failures aren't the ticket's, and an `index.lock` collision is
   worth a retry, not a handoff. A subagent that doesn't know it has neighbors
   reads their noise as its own failure.

2. **Which delivery applies** — the row you picked from the
   [delivery gate](#ticket-delivery-gate) table: whether to run the standards
   pass, and that the ticket isn't delivered until it's gated _and_ committed.
   A registered agent already knows the steps; what it can't know is which of
   the three variants its ticket is.
3. The retry budget, stated outright. This is the part that's easy to leave out
   and the whole reason the failsafe exists: a subagent never told it has three
   attempts and a way out will grind, or trim the ticket down to something it
   can pass. Give it explicit permission to stop:

   > You have three delivery attempts (implement/fix → run the gate). If the
   > gate still fails after the third, stop and reply with a handoff report
   > starting with the line "This feels too complex for me", followed by the
   > ticket id, attempts, what you tried, the verbatim blocker, and what state
   > you left on disk. Reply the same way immediately, without using the
   > attempts, if the ticket is missing context you need, contradicts the
   > codebase, or requires a decision that isn't yours to make. Reporting back
   > is the correct outcome in those cases — do not narrow the ticket's scope
   > or weaken the gate to produce a pass.

4. On a re-dispatch: the previous tier's handoff report, labelled as such, so
   the stronger model starts from what already didn't work.

A registered `plan-developer` / `plan-tester` carries the gate steps and the
budget in its own body, so its dispatch needs items 1, 2, and 4 — item 3 is
already in there. Spell all four out when falling back to `general-purpose`.

## Retry budget and escalation

A cheap subagent that can't land a ticket is an expected outcome of cost
tiering, not an anomaly — starting at the cheapest capable tier means sometimes
it turns out not to be capable. A bounded budget and an honest handoff are what
make that cost one short run instead of a subagent looping on a `FAIL` forever
or quietly narrowing the ticket until something passes.

The budget itself is the subagent's — three delivery attempts, then stop, and
report immediately without spending them when the blocker is a specification
problem retries can't fix. **This section is what _you_ do when one comes
back.**

**The handoff report** takes this shape, so the lead can act without replaying
the run:

```
This feels too complex for me.

Ticket: <id> — <title>
Attempts: <n>
What I tried: <one line per attempt — the approach, and how the gate answered>
Blocker: <the specific thing that kept failing; quote the qoq FAIL text verbatim>
State: <what's on disk now — files modified but uncommitted, or reverted clean>
```

The first line is what you match on; the rest keeps the next tier out of the
same dead end.

**The response is to re-dispatch one rung up** — same ticket, same acceptance
criteria, the tier its **Escalation** ladder points to (`haiku` →
moderate's tier → judgment's tier), and the handoff report pasted in. Record it
in the ticket's **Escalation** field. An escalation is information, not a
failure to hide: a ticket that needed a rung up was mis-rated, and writing that
down is how the next plan rates better.

**At the top rung there is no next tier**, because the top rung is the model
the user chose. A dispatch there that still burns its budget means one of two
things, both the user's call:

- **The ticket is wrong** — under-specified, too big, or resting on a decision
  that was never the implementer's to make. It needs respecifying or splitting
  back in `planning-gate`, not another run.
- **The session's model isn't strong enough.** The fix is restarting on a
  stronger model and resuming this plan.

Either way: **Status** → `blocked`, bring the user the handoff report plus
which of the two you think it is. Don't finish it on this thread — that's the
same model that just failed, now burning the lead's context and hiding a
planning defect that will recur in the next plan.

## Ticket delivery gate

**The subagent runs the gate; you decide which one it runs.** The steps —
`qoq gate` over the explicit file list, the reaction to `PASS`/`FAIL`, the
commit — live in the agent definitions ([plan-developer](agents/plan-developer.md),
[plan-tester](agents/plan-tester.md)), which is also what gets pasted on the
`general-purpose` fallback. They aren't repeated here, because a second copy
drifts from the first and then nobody knows which is running.

What is yours is the routing, and it's two reads of the ticket:

| Ticket                                        | Delivery                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| **Files** has only `Test:` entries            | `plan-tester` → `testing-gate` (which gates itself through `qoq`), then commit |
| **Complexity** `moderate` or `judgment-heavy` | `plan-developer` → `qoq refactor` standards pass, then `qoq gate`, then commit |
| **Complexity** `trivial` or `mechanical`      | `plan-developer` → `qoq gate`, then commit — no standards pass                 |

Both distinctions are about spending where it pays. `testing-gate` authors
coverage against code that already exists, so pointing it at a ticket that is
_building_ that code burns a subagent duplicating tests the implementer writes
anyway. And `refactor`'s lenses ask whether the code is over-built and whether
it's the right pattern — questions that only exist where a decision was made,
which is what the complexity rating already tells you. Say in the dispatch
which of the three applies; the agent won't add a standards pass it wasn't
asked for.

Every invocation carries `--run <ticket id>` so concurrent tickets don't share
a scratch workspace — see
[What a wave shares](#what-a-wave-shares-and-what-it-must-not).

**Your side of it** is what comes back: `PASS` → **Status** `done`, advisories
from every command copied into **Advisories** verbatim, commit hash into
**Commit**. Never mark a ticket done without a `PASS`, and never loosen the
gate to get one — a handoff report is the correct outcome, and
[escalation](#retry-budget-and-escalation) is what it's for.

**Commit link.** If `git remote get-url origin` resolves to github.com,
gitlab.com, or bitbucket.org, format **Commit** as
`[<short-hash>](<https-url>/commit/<hash>)` — strip a trailing `.git` and
convert `ssh://`/`git@` to `https://` first. No remote, or an unrecognized
host: record the bare hash rather than guessing a URL.

## Phase 3 — Milestone gate

Once every ticket in a milestone is `done`, run the full quality suite as its
own phase — deliberately broader than any ticket's gate, to catch integration
issues between tickets that individually passed:

1. `qoq refactor <every file the milestone's tickets touched> --decisions auto
--run milestone-<N>` — the union of all their **Files**, which you have in
   the plan.

   **`refactor`, not `gate`, and this is the one place it belongs.** The
   milestone is the first moment the tickets exist as one piece of code, so
   it's the only scope where the cross-file questions can be asked at all:
   duplication between two tickets' files, an export one ticket created that
   another left dead, three tickets that each reasonably chose a different
   shape for the same idea. `gate` is the seven dimensions and nothing else;
   `refactor` runs those plus the minimalism and design-pattern lenses, and
   running them once here over the union costs a fraction of running them per
   ticket over scopes too small to see any of it.

   The tree is clean by now (every ticket committed), which is exactly
   `refactor`'s default mode — no `--tree dirty` needed. `--decisions auto`
   keeps it unattended: safe tier applied, judgment calls returned as
   advisories.

   **Pass the union explicitly.** With no scope, `refactor` widens to the whole
   project — far more than this milestone, and slow enough to matter.

2. The project's **full** build and test commands from the plan header — not
   the scoped single-file commands the ticket gates used.

**Delegate this run too.** A full build and test suite emits thousands of lines
the lead has no use for once it knows the verdict, and it's the lead's context
that has to survive the rest of the plan. Dispatch one subagent — `refactor`
does its own analysis and its own tiering internally, so this agent is just
running commands and relaying output; the cheapest tier is right. Ask for the
verdict plus the verbatim failures:

> Run `qoq refactor <the union of the milestone's files> --decisions auto --run
milestone-<N>`, then `<full build command>` and `<full test command>`.
> `refactor` in auto mode applies its safe tier by design — let it, and report
> what it changed and every advisory it returned verbatim; beyond that, make no
> edits and fix nothing yourself. Reply with each command's pass/fail, the files
> `refactor` modified, any review lens it reported as skipped, and for anything
> that failed, the verbatim error output and the files it names.

Advisories from this run are the milestone's, not any one ticket's — record
them in the `## Completed` summary's **Open advisories** line so they don't
evaporate when the milestone is archived.

**If `refactor` applied fixes, they're sitting uncommitted.** Commit them as
`<milestone>: gate fixes` before archiving — leaving them dirty means the next
milestone's tickets start from a tree that isn't what their plan describes, and
the next per-ticket gate picks them up as if that ticket had written them.

Both green → delivered; archive before starting the next milestone. Either red
→ write the failure up as a new ticket in the milestone (sized, rated, tiered
like any other) and dispatch it. An integration failure between two passing
tickets is real work with a real diff; routing it through the same
dispatch-gate-commit path keeps it reviewable and the milestone's history
honest about what it took to land.

## Archiving a delivered milestone

A delivered milestone's tickets are finished history — their Context and
acceptance criteria briefed subagents that will never be dispatched again. Left
inline, every later status check and resume pays for the whole backlog, and the
lead's attention is the one resource here that doesn't scale. The plan should
read as "what's left."

On delivery, move the milestone's full text to
`./plans/<same-plan-name>.completed.md` (create at the first archive, append
after) and leave a summary block under a `## Completed` section at the top of
the plan. Both shapes are in
[planning-gate's plan template](../planning-gate/references/plan-template.md).

**That summary is for the lead; no subagent will ever read it.** When delivery
established something a later ticket depends on — a real exported name, a
signature that shifted, a file that landed elsewhere than planned — edit that
into the downstream tickets' **Context** fields _first_, then write the
summary. A decision recorded only under `## Completed` is invisible to the cold
subagent that needs it.

Keep the summary to a few lines. If it's becoming a design document, that's
what the archive file is for — the plan gets shorter as work lands, not longer.

## Resume

A resume is just Phase 1 followed by Phase 2 — no separate mode. The
plan file's **Status** fields are the source of truth, including across
sessions, so re-reading it (Phase 1) is the whole of "catching up".

Two things differ:

- **A `blocked` ticket whose Escalation field is already filled dispatches at
  the tier it escalated _to_, not the tier that failed.** Re-running that rung
  is the one thing already known not to work.
- **An `in-progress` ticket is an interrupted dispatch, not a running one** —
  reconcile it against git and re-dispatch per [Phase 1](#phase-1--load-the-plan)
  before treating the wave as complete.

Otherwise pick up `todo`, `in-progress`, and `blocked` tickets in
dependency-ordered waves, the same as a fresh run — a resume with three
unblocked tickets left dispatches all three at once.

Also clear any leftover `.qoq/runs/` directories from the dead session before
dispatching: `ls .qoq/runs` shows one per interrupted ticket, and leaving them
is what stops the last live run's cleanup from ever tearing the workspace down.
`node <qoq skill>/scripts/workspace.mjs cleanup --run <id>` each one.

## Anti-patterns

The common mistakes, and what each one actually costs:

| Pitfall                                                                 | Why it bites                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Implementing "just the trivial ticket" on the lead thread               | If the lead implements anything, its context fills with implementation detail and the plan's tiering stops meaning anything. Cost is the same either way — a subagent's context is disposable.                                                                           |
| Running the milestone's full build and test suite on the lead thread    | Thousands of lines of output the lead stops needing the moment it knows the verdict, spent from the one context that has to survive the whole plan. Delegate the run, take back pass/fail plus the verbatim failures.                                                    |
| Working a wave of independent tickets one at a time                     | Tickets with disjoint files and no dependency between them have nothing to serialize on. Dispatching them one per turn multiplies wall-clock time by the wave size for no benefit. If serialization is genuinely wanted, that's `--parallelism linear`, chosen out loud. |
| Treating `linear` as permission to implement inline                     | It bounds concurrency, nothing else. One ticket at a time still means one _subagent_ at a time.                                                                                                                                                                          |
| Marking a ticket done on a `FAIL`, or narrowing scope to force a `PASS` | Converts a visible blocker into a silent one. Hand the ticket back instead — reporting back is the correct outcome.                                                                                                                                                      |
| Re-dispatching a `blocked` ticket at the tier that already failed       | The one rung already known not to work. Resume at the tier its **Escalation** field points to.                                                                                                                                                                           |
| Finishing a top-tier failure on the lead thread                         | Same model that just failed, now spending the context that has to last. It also hides a planning defect that will recur in the next plan.                                                                                                                                |
| Recording a delivery decision only under `## Completed`                 | No subagent ever reads that section. If a later ticket depends on the fact, it belongs in that ticket's **Context**.                                                                                                                                                     |
| Re-running discovery or re-rating tickets on a resume                   | Those decisions were made and approved at planning time. Re-deriving them burns context and risks contradicting the plan the user signed off on.                                                                                                                         |
| Skipping an `in-progress` ticket on a resume                            | Nothing is working it — the status is a dispatch that never reported back. Skipped, it is never built and never mentioned, and the milestone gate passes over work that doesn't exist. Reconcile it against `git log` and re-dispatch.                                   |
| Opening `<plan>.completed.md` "to get up to speed"                      | Archiving exists precisely so a resume doesn't cost the whole history. The `## Completed` summary is sufficient unless you have a specific question it can't answer.                                                                                                     |
| Redesigning an under-specified ticket here                              | Ticket quality is `planning-gate`'s contract. Silently fixing it means the plan on disk no longer describes what was built, and the next resume works from the wrong text.                                                                                               |
