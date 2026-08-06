---
name: planning-gate
description: >-
  Decomposes a spec, feature request, or rough requirements description into
  a milestone/ticket implementation plan for a cost-tiered subagent
  orchestrator: every ticket is t-shirt sized, rated for complexity so the
  cheapest capable agent tier gets assigned, self-contained enough for a
  subagent to pick up cold with no shared context, and gated on delivery by
  QoQ's `gate` command — plus the `testing-gate` skill on tickets whose whole
  deliverable is test coverage. Use whenever the user wants to plan out a feature before
  writing code, break a spec/PRD/requirements doc into milestones and tickets,
  decompose work for multiple subagents to execute, size and triage tickets by
  complexity, or asks "what's the implementation plan for X" — even if they
  don't say "planning-gate" or name qoq/testing-gate explicitly. Hands the
  approved plan to the `execution-gate` skill, which owns everything after
  sign-off — dispatch, gates, and resume.
argument-hint: '[requirements description or spec]'
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
  - Bash(git diff:*)
  - Bash(git log:*)
  - Bash(git rev-parse:*)
  - Bash(git remote:*)
  - Bash(npm run:*)
  - Bash(npm test:*)
  - Bash(yarn:*)
  - Bash(pnpm:*)
metadata:
  version: 0.5.0
---

Turns requirements into a plan file an orchestrator can actually execute:
every ticket sized, complexity-rated, tiered to a specific agent, and gated
on delivery — never a prose outline someone has to reinterpret before
dispatching work against it.

**Every ticket will be executed by a subagent that has never seen this
conversation.** That single fact drives most of the decisions here: why
**Context** has to stand alone, why complexity is rated now rather than left
for the implementer to self-assess, and why a dependency written in out of
narrative habit costs real wall-clock time later. Plan for a cold reader.

**This skill plans; it does not execute or define quality.** Dispatch, gates,
escalation, and resume belong to [`execution-gate`](../execution-gate/SKILL.md);
the quality bar itself belongs to `qoq` and `testing-gate`, consumed on their
own published terms. This skill's job ends at "the plan is approved."

## When to use it

Reach for this when work needs decomposing before anyone writes code: a spec
or PRD to break down, a feature spanning several files, or work to be spread
across multiple subagents.

Don't reach for it when a plan would cost more than the work. A single-file
change, a bug with a known root cause, or anything that lands in one gated
edit should go straight to the code — a plan file for it is ceremony, and the
`qoq` gate alone already covers the quality bar. If the work is only ever one
ticket, it isn't a plan.

**A plan that already exists is not this skill's job.** If the argument is a
path under `./plans/`, or the user says "resume", "execute", "start building",
or "close out milestone N", that's [`execution-gate`](../execution-gate/SKILL.md)
— hand it straight over rather than re-deriving a plan that's already approved.
Come back here only to re-plan a ticket that execution handed back as
under-specified.

## Setup check

`qoq` gates every ticket, so check whether it's in your available-skills
listing before drafting. Missing isn't fatal here — the deliverable is a
markdown file, and a plan is still worth writing — but it will be fatal at
execution time, so say so now and keep the gate steps in the plan exactly as
written. Never draft a plan with them quietly omitted, and don't install
anything yourself.

`testing-gate` missing matters even less: note it and raise it at Phase 4 if
decomposition produces a test-only ticket — one whose **Files** lists nothing
but `Test:` entries. Tickets that ship a feature alongside its tests don't
need the skill at all; the implementer writes those tests as part of the
change, reading
[`testing-gate/references/conventions.md`](../testing-gate/references/conventions.md)
for the house rules, and `qoq gate` covers the result. Expect that to be most
tickets.

## Phase 1 — Discovery

Tickets written from guesses reinvent helpers that already exist and assume
libraries that aren't installed. Find out what the project actually has
first.

**Delegate this.** Discovery is high-volume, zero-judgment reading — exactly
the work that shouldn't sit in the orchestrator's context, and on a monorepo
it's the largest single consumer of it. Dispatch one `Explore` subagent and
take back a summary:

> Report on this repo, for planning work on: `<the requirements, in one or
two sentences>`.
>
> 1. Dependencies and scripts from `package.json` (root, plus any package
>    the work touches) — name the exact build, test, and lint commands.
> 2. Existing patterns the work will touch: similar components, service or
>    controller shapes, module layout. Give exact file paths.
> 3. Test runner, config, and file-naming conventions.
>    Report findings only, with paths. Make no edits.

Read the requirements yourself, in full, if they arrive as a file path —
decomposing from a paraphrase is how requirements get silently dropped.

## Scope check

Requirements spanning genuinely independent subsystems ("add billing" and
"redesign the settings page" in one request) become **separate plans**, not
one plan with both. A plan covering unrelated subsystems is harder to review,
can't be approved atomically, and resumes badly. Say so and split, rather
than complying silently or refusing.

An `XL` milestone found mid-decomposition is the same signal arriving later:
it means one milestone is really two plans.

## Phase 2 — Decomposition

Draft against [references/plan-template.md](references/plan-template.md) —
that file is the single source of truth for the plan's shape. Assign size,
complexity, and tier as you write each ticket, not in a pass afterward.

### T-shirt sizing

Size is diff footprint, not time-to-complete:

| Size | Footprint                                                      |
| ---- | -------------------------------------------------------------- |
| XS   | 1 file, small diff, at most one new test scenario              |
| S    | 1–2 files, one cohesive change, straightforward tests          |
| M    | 3–5 files, or one new module/component with several test cases |

**There is no valid ticket larger than `M`.** More than 5 files, or crossing
a subsystem boundary, means split it into multiple tickets before writing it
down — a size that big is a decomposition that hasn't finished, and a cold
subagent handed one has no way to tell which half matters.

Milestone size (`S`/`M`/`L`/`XL`) is a roll-up judgment call, not a sum. `XL`
follows the scope check above: its own plan.

### Complexity → agent tier

Complexity is decided here, by you, during planning — never left for the
executing subagent to self-assess. One table, so the tiers can be retuned
without hunting through the file:

| Complexity     | Signal                                                                              | Tier                    | Escalates to       |
| -------------- | ----------------------------------------------------------------------------------- | ----------------------- | ------------------ |
| Trivial        | Single file, mechanical, pattern already established elsewhere, no decision to make | `haiku`                 | moderate's tier    |
| Mechanical     | Multiple files but rote — same change in N places, wire up an existing interface    | `haiku`                 | moderate's tier    |
| Moderate       | New logic, local design decisions, unambiguous scope and acceptance criteria        | `sonnet`                | judgment's tier    |
| Judgment-heavy | Cross-cutting, ambiguous, architecture-shaping, security/perf tradeoffs             | the session's own model | nothing — the user |

Rate honestly in both directions. Don't downgrade a judgment-heavy ticket to
keep the plan looking parallelizable, and don't inflate a mechanical one "to
be safe" — the escalation ladder means guessing too low costs one cheap run,
not a broken ticket.

**Complexity buys more than a model.** It also decides whether the ticket runs
the `qoq refactor` standards pass on delivery: `moderate` and `judgment-heavy`
do, `trivial` and `mechanical` don't. Those lenses ask whether the code is
over-built and whether it's the right pattern — questions that only exist
where a decision was made, and a ticket rated trivial is one where the plan
already made it. Inflating a rating doesn't just spend a bigger model; it
adds two more review subagents to a ticket with nothing for them to find. The
code is still covered — the milestone gate runs the wide lens over every
ticket's files together, which is where cross-file findings live anyway.

**The top tier is the model this session is already running on, and nothing
above it.** Read that model ID from your own system prompt and pass it
explicitly as the dispatch's `model` — don't omit the parameter hoping the
subagent inherits it, since a subagent's model comes from its own agent
definition before it falls back to the parent. Spending more is the user's
call: if the session runs on a mid-tier model and the plan has tickets that
plausibly need more, say so at Phase 4 so they can restart _before_ any
dispatch.

Judgment-heavy tickets are still delegated, at that ceiling — same model
either way, but the orchestrator's context stays free.

### Writing a self-contained ticket — a worked example

Sizing and tiering are the easy part; **Context** is where plans actually
fail. The subagent that receives it has never seen this conversation, the
other tickets, or the repo. Whatever the field leaves implicit, it invents.

Two versions of the same ticket. The first example is what a planner writes
while it's still holding the whole plan in its head:

```markdown
### Ticket 2.2: Add rate limiting to the auth routes

- **Files:**
  - Modify: the auth controller

**Context:** Add rate limiting like we discussed. Follow the same approach as
Ticket 1.4 and handle the edge cases. Use the usual middleware pattern.
```

Every phrase there resolves to nothing on the other side: "as we discussed",
"like Ticket 1.4", "the usual pattern", "the edge cases", and a **Files**
entry that sends the subagent grepping. Rewritten so it stands alone:

```markdown
### Ticket 2.2: Add rate limiting to the auth routes

- **Files:**
  - Create: `src/auth/rate-limit.guard.ts`
  - Modify: `src/auth/auth.controller.ts:18-52`
  - Test: `src/auth/rate-limit.guard.spec.ts`

**Context:** `AuthController` exposes `login`, `refresh`, and
`requestPasswordReset`. Each should reject a caller after 5 attempts in 60
seconds, keyed on client IP, returning 429. `@nestjs/throttler` is already a
dependency and registered in `src/app.module.ts` — use its `ThrottlerGuard`
rather than adding a limiter. Follow the guard shape in
`src/common/roles.guard.ts`: implements `CanActivate`, applied per-route with
`@UseGuards`, never registered globally.

**Acceptance criteria:**

- [ ] A 6th request inside 60s to any of the three routes returns 429
- [ ] The counter is per-IP, so one client's limit doesn't affect another's
- [ ] Successful requests under the limit are unaffected
```

The rewrite is longer, and that's the trade the plan is making: pay the words
once at planning time, or pay for a wrong guess at execution time when the
subagent is the only one still awake. If writing a ticket's Context feels
tedious, that's usually the signal it wasn't decomposed far enough.

### Dependency discipline

- Never install a dependency without explicit user approval, however
  obviously a ticket seems to need it.
- Build only what the current ticket's acceptance criteria require. No
  speculative abstractions, no unused exports, no "the next ticket will need
  this." `knip` runs inside `qoq`'s engine and flags exactly this downstream.
- A genuine new-dependency need goes in that ticket's **Needs approval**
  field, and gets raised again at Phase 4 — never added to `package.json`
  during decomposition.

## Phase 3 — Self-review

Different subagents implement different tickets with no shared context to
catch a mismatch, so check all three before presenting:

1. **Requirements coverage.** Every requirement maps to at least one ticket.
   A requirement with no ticket is a gap, not an implicit "later."
2. **No placeholders.** Scan the draft for "TBD", "handle edge cases",
   "similar to", "etc." **Context** is where these creep in. Write the real
   thing.
3. **Cross-ticket interface consistency.** Where two tickets share a type,
   signature, or API shape, both must describe it identically. The subagent
   on Ticket 2.3 will never read Ticket 1.1, so a mismatch here ships as an
   integration bug.
4. **Dependencies are real.** Execution dispatches tickets in parallel waves,
   and **Depends on** is the one thing that holds a ticket out of a wave — so
   a dependency written in out of narrative habit ("2.2 comes after 2.1")
   silently serializes work that had no reason to be. Keep it only where the
   ticket genuinely cannot start until the other has landed: it needs a file,
   type, or export the other one creates. Overlapping **Files** already
   handle themselves at execution time and don't need a dependency to
   enforce.

## Phase 4 — Plan approval

Save to `./plans/YYYY-MM-DD-<feature-name>.md` (ask if the user prefers
elsewhere) and present for approval. Dispatch nothing before they approve.

Surface in the same pass:

- Every **Needs approval** dependency, so new deps get signed off with the
  plan rather than discovered mid-execution.
- The model ceiling, if the plan has judgment-heavy tickets and this session
  is running mid- or low-tier — those dispatch at the session's model with
  nothing above to escalate to, so restarting has to happen now. State it
  once as a fact about the plan and take their answer; the plan runs fine
  either way.
- `testing-gate` being absent, if any ticket is test-only.

Set **Plan status** to `approved` on sign-off, and record the project's full
build and test commands from Phase 1 in the plan's **Commands** header — the
milestone gate needs them, and by then this conversation's discovery is gone.

Then hand off. Execution is a separate skill so the orchestrator that runs the
plan doesn't inherit a context full of decomposition reasoning it will never
use again — the plan file is the whole handoff, which is also what lets a
different session resume it tomorrow. Tell the user plainly:

> The plan is approved and saved at `./plans/<file>.md`. Run
> `/execution-gate ./plans/<file>.md` to build it — every ticket dispatches to
> a subagent at the tier this plan assigned, gated and committed. Add
> `--parallelism linear` if you want them one at a time instead of in parallel
> waves.

Offer to invoke it now. If they say yes, invoke the `execution-gate` skill with
that path; don't start dispatching tickets from here.

## Anti-patterns

The common mistakes, and what each one actually costs:

| Pitfall                                                                 | Why it bites                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Starting to implement instead of finishing the plan                     | Planning and executing are different skills with different contexts for a reason. A half-built feature makes the remaining tickets impossible to size honestly. Finish the plan, get it approved, hand it to `execution-gate`. |
| Sizing a ticket `L` to avoid splitting it                               | Oversized tickets are unfinished decomposition. A cold subagent handed one can't tell which half matters, and the escalation ladder can't rescue a scoping failure.                                                            |
| Inflating complexity "to be safe"                                       | Every ticket then runs at the top tier and the cost tiering buys nothing. Guessing too low costs one cheap run; the escalation ladder exists for exactly that.                                                                 |
| Writing Context that points sideways ("see Ticket 1.2", "as discussed") | Resolves to nothing for the subagent. It invents a plausible substitute, and the mismatch surfaces as an integration bug a milestone later.                                                                                    |
| Writing a **Depends on** that isn't real                                | It's the one thing that holds a ticket out of a parallel wave. A dependency added out of narrative habit silently serializes work that had no reason to be.                                                                    |
| Adding a dependency a ticket "obviously needs"                          | Never the planner's call. It goes in **Needs approval** and gets raised at Phase 4, before dispatch.                                                                                                                           |
| Leaving the **Commands** header empty                                   | The milestone gate runs the project's full build and test commands, and by then Phase 1's discovery is a conversation nobody has anymore. Record them while you still know them.                                               |

## Storage convention

Plans live at `./plans/YYYY-MM-DD-<feature-name>.md`, dated when first
drafted, not when resumed. Delivered milestones move to
`./plans/YYYY-MM-DD-<feature-name>.completed.md` — same base name, so the
pair is obvious in a listing and a resume never guesses which archive belongs
to which plan.
