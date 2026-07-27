---
name: planning-gate
description: >-
  Decomposes a spec, feature request, or rough requirements description into
  a milestone/ticket implementation plan for a cost-tiered subagent
  orchestrator: every ticket is t-shirt sized, rated for complexity so the
  cheapest capable agent tier gets assigned, self-contained enough for a
  subagent to pick up cold with no shared context, and gated on delivery by
  QoQ's `gate` command plus the `testing-gate` skill, with a full quality
  suite run at the end of each milestone. Use whenever the user wants to plan
  out a feature before writing code, break a spec/PRD/requirements doc into
  milestones and tickets, decompose work for multiple subagents to execute,
  size and triage tickets by complexity, or asks "what's the implementation
  plan for X" — even if they don't say "planning-gate" or name qoq/testing-gate
  explicitly. Also use to resume or check status on a plan file already saved
  under `./plans/`.
argument-hint: '[requirements description or spec, or "resume ./plans/<file>.md"]'
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
  - Bash(npm run:*)
metadata:
  version: 0.1.0
---

Turns requirements into a plan file an orchestrator can actually execute:
every ticket sized, complexity-rated, tiered to a specific agent, and gated
on delivery — never a prose outline someone has to reinterpret before
dispatching work against it.

**This skill is a producer of work, not a quality engine.** It does not
re-implement linting, testing, or review standards — it consumes `qoq` and
`testing-gate` exactly the way `qoq`'s own SKILL.md defines the contract for
callers (see
[Ticket delivery gate](#ticket-delivery-gate--per-ticket-consumes-testing-gate--qoq)
below, which quotes that contract rather than restating a different one).
Planning and gating are separate concerns on purpose: this skill's job ends
at "the plan is approved and tickets are dispatched with a working gate
attached to each one" — it does not decide what "passing" means.

## Setup check (run once, before anything else)

The per-ticket and per-milestone gates below are meaningless if `qoq` and
`testing-gate` aren't actually available to dispatch to. Confirm both are
installed **once**, at the start of planning — not per-ticket, and not
re-checked during execution.

The check is cheap: the list of skills already available to you (the same
listing that tells you this skill itself is installed) either names `qoq`
and `testing-gate`, or it doesn't.

- **Both present** — continue to Phase 1.
- **Either missing** — stop here. Tell the user plainly which one(s) are
  missing and that they need to be installed before `planning-gate` can
  produce a plan whose delivery gates actually run. Do not draft a plan with
  the gate steps quietly omitted, and do not attempt to install either skill
  yourself — that's the user's call, same as `qoq` never self-installs its
  own external lenses.

## Phase 1 — Discovery

Before drafting a single ticket, find out what the project already has —
guessing here produces tickets that reinvent an existing helper or assume a
library that isn't installed.

- Read `package.json` (root and, in a monorepo, the affected packages) for
  existing dependencies and scripts — the build/test/lint commands the
  milestone gate will need later (Phase 6) live here.
- Grep/Glob for existing patterns the requirements are likely to touch —
  similar components, existing service/controller shapes, test conventions
  — the same discovery-over-assumption principle `qoq`'s own commands use
  before analyzing anything.
- Note the test runner and framework conventions if `testing-gate` will be
  invoked later (it re-discovers this itself per-ticket, but knowing it now
  helps write realistic acceptance criteria).

If the requirements come as a file path, read it in full before decomposing
— don't decompose from a paraphrase.

## Scope check

If the requirements span multiple genuinely independent subsystems (for
example: "add billing" and "redesign the settings page" arrived in the same
request), split them into **separate plans** before decomposing into
tickets, rather than forcing one plan to cover both. This is the same
principle obra/superpowers' `writing-plans` calls a scope check: a plan that
tries to cover unrelated subsystems is harder to review, harder to approve
atomically, and harder to resume correctly. An `XL` milestone (see sizing
below) discovered mid-decomposition is a second version of this same signal
— it means what looked like one milestone is really two plans.

## Phase 2 — Decomposition

Draft milestones and tickets against
[references/plan-template.md](references/plan-template.md) — that file is
the single source of truth for the plan's shape; don't improvise a different
structure. Assign every ticket a size, a complexity rating, and an agent
tier as you write it, not as a pass afterward.

### T-shirt sizing

Ticket size is about diff footprint, not time-to-complete:

| Size | Footprint                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| XS   | 1 file, small diff, no new test scenarios beyond one                                                                           |
| S    | 1–2 files, one cohesive change, straightforward tests                                                                          |
| M    | 3–5 files, or one new module/component with several test cases                                                                 |
| L    | More than 5 files or crosses a subsystem boundary — flag it for splitting into multiple tickets rather than accepting it as-is |

Milestone size (`S`/`M`/`L`/`XL`) is a roll-up judgment call, not a sum of
ticket sizes. An `XL` milestone is the same signal as the scope check above:
it should become its own separate plan.

### Complexity → agent tier

Every ticket's complexity is decided here, during planning, by you — never
left for the executing subagent to self-assess. The tier names below are a
single named config point (mirroring how `qoq`'s own external-lens tiering
works — one table, not a choice re-made at each dispatch site) so they can
be retuned later without hunting through this file:

| Complexity     | Signal                                                                                              | Named tier point         | Default agent tier                         |
| -------------- | --------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------ |
| Trivial        | Single file, mechanical, pattern already established elsewhere in the codebase, no decision to make | `ticket.trivial.tier`    | cheapest available subagent (e.g. `haiku`) |
| Mechanical     | Multiple files but rote — apply the same change N places, wire up an existing interface             | `ticket.mechanical.tier` | cheap/mid subagent (e.g. `haiku`)          |
| Moderate       | New logic, local design decisions, but scope and acceptance criteria are unambiguous                | `ticket.moderate.tier`   | mid-tier subagent (e.g. `sonnet`)          |
| Judgment-heavy | Cross-cutting, ambiguous requirements, architecture-shaping, security/perf tradeoffs                | —                        | **main-thread — never delegated**          |

Pass the tier straight through as the `model` parameter of the ticket's
dispatch (Phase 5). If a ticket looks judgment-heavy, say so explicitly in
the plan and keep it on the main thread — don't downgrade it to fit a
cheaper tier just to keep the plan looking parallelizable. This is the same
principle the source spec for this skill states directly: judgment and
ambiguity resolution stay on the main thread; only mechanical, rule-bound
work gets delegated.

### Dependency / install discipline

- Never install a dependency without explicit user approval, even one a
  ticket seems to obviously need.
- Build only what the current ticket's acceptance criteria require — no
  speculative abstractions, no unused exports, no "the next ticket will
  need this" scaffolding. `knip` (part of `qoq`'s own engine) will flag
  exactly this kind of dead code downstream, and the milestone gate
  (Phase 6) will catch it.
- If decomposition surfaces a genuine new-dependency need, write it under
  that ticket's **Needs approval** field instead of assuming it — don't
  silently add it to `package.json` during Phase 2, and flag it again during
  Phase 4 approval so the user sees it before that ticket is ever dispatched.

## Phase 3 — Self-review

Before presenting the plan, check it against all three of these — this
matters more here than in a single-executor plan, since different subagents
implement different tickets with no shared context to catch a mismatch:

1. **Requirements coverage.** Every requirement in the source maps to at
   least one ticket. If something in the requirements has no ticket, that's
   a gap, not an implicit "later."
2. **No-placeholder scan.** Grep the plan you just wrote for "TBD", "handle
   edge cases", "similar to", "etc." — anything that reads as a placeholder
   rather than actual content. A ticket's **Context** field is where this
   most often creeps in; go back and write the real thing.
3. **Cross-ticket interface consistency.** Where two tickets share a type,
   function signature, or API shape, confirm both tickets describe it
   identically. A subagent implementing Ticket 2.3 will never read Ticket
   1.1's notes, so a mismatch here becomes a real integration bug, not just
   a documentation inconsistency.

## Phase 4 — Plan approval

Save the draft to `./plans/YYYY-MM-DD-<feature-name>.md` (ask if the user
states a different location preference) and present it for approval. Do not
dispatch any subagent before the user approves. Also surface, at this point,
every ticket that flagged a **Needs approval** dependency — the user should
sign off on new dependencies in the same pass as the plan itself, not
discover them mid-execution.

Set **Plan status** to `approved` once the user signs off.

## Phase 5 — Execution loop

Work tickets in dependency order. Parallel dispatch is allowed only across
tickets with disjoint file sets — never two agents touching the same file,
since there's no merge step in this workflow to reconcile that.

For each ticket:

1. Set **Status** to `in-progress` in the plan file.
2. **Dispatch:**
   - `trivial` / `mechanical` / `moderate` → the Agent tool, `model` set to
     the tier from the table above, with a prompt built entirely from that
     ticket's **Context**, **Files**, and **Acceptance criteria** fields —
     a fresh subagent has zero access to this conversation, so paste
     everything in rather than referencing "the plan" or another ticket.
   - `judgment-heavy` → handle inline, on the main thread.
3. The implementer (subagent or you) writes the code, then runs the
   ticket's own delivery gate below.
4. **On PASS** — flip **Status** to `done`, copy any advisories into the
   ticket's **Advisories** field.
5. **On FAIL after reasonable effort to fix** — leave **Status** as
   `blocked`, do not mark the ticket done, and escalate to the user rather
   than retrying indefinitely or loosening the gate.

### Ticket delivery gate — per-ticket, consumes `testing-gate` + `qoq`

This is not a new contract — it's `qoq`'s own, applied with an explicit file
list every time, because a ticket's implementer always knows exactly which
files it just touched:

1. Run `testing-gate` over the files the ticket touched (it writes/updates
   tests and, as its own last phase, already gates itself through `qoq`).
2. Run `qoq gate <the files touched>` — the explicit list from the ticket's
   **Files** field, never an inferred/dirty-tree scope. Per
   [qoq's own contract](../qoq/SKILL.md#consuming-qoq-from-another-skill):

   > Run `/qoq gate <the files you changed>` and wait for its verdict. If it
   > returns `FAIL`, fix the reported blockers and re-run it. Only declare
   > the task complete on `PASS`; pass along any advisories it reported.

3. React exactly as that contract says: `PASS` → ticket is done, advisories
   ride along into the ticket's notes for the user, never dropped silently.
   `FAIL` → fix the reported blockers and re-gate; if it still won't pass
   after reasonable effort, stop and report back up rather than marking the
   ticket done or weakening the gate to force a pass.

## Phase 6 — Milestone gate

Once every ticket in a milestone is `done`, run the full quality suite as
its own phase — deliberately broader than any single ticket's gate, to
catch integration issues between tickets that individually passed:

1. `qoq gate` with **no explicit paths** — this makes it infer scope from
   everything currently dirty in the milestone, not just one ticket's files.
2. The project's own **full** build and test commands from Phase 1's
   discovery (`npm run build`, `npm test`, etc.) — not the scoped
   single-file commands a ticket's own gate used.

Both green → set the milestone's tickets' rollup complete and move to the
next milestone. Either red → treat it the same as a ticket-level `FAIL`:
fix and re-run, or escalate to the user if it doesn't resolve.

## Resume support

The plan file's **Status** fields (plan-level and per-ticket) are the source
of truth for resuming later, including across sessions. Re-entering
execution on an existing plan:

- Read the plan file fresh rather than trusting memory of an earlier
  session.
- Skip every ticket already `done` — don't re-decide its scope or re-run its
  gate.
- Pick up `todo` and `blocked` tickets in dependency order, same as a fresh
  run.

If the user's argument is a path to an existing file under `./plans/`
(rather than new requirements text), treat this as a resume request: read
that plan and jump straight to Phase 5 — Discovery, the scope check, and
Phase 2's decomposition don't re-run against an already-approved plan.

## Storage convention

Plans save to `./plans/YYYY-MM-DD-<feature-name>.md`. Use the date the plan
is first drafted, not the date of any later resume.
