# Plan template

Copy this structure for every new plan file. The fixed shape is what lets `qoq
execute` resume a plan across sessions, and what lets a cold subagent trust that
"Status" and "Definition of done" mean the same thing in every ticket it's ever
handed. Fill in the `<…>` placeholders; don't add or remove sections.

```markdown
# <Feature Name> Implementation Plan

**Goal:** <one sentence>
**Architecture:** <2-3 sentences>
**Requirements source:** <link or short description of what was decomposed>
**Commands:** build `<full build command>` · test `<full test command>`
**Plan status:** draft | approved | in-progress | complete

---

## Completed

<!-- Absent on a fresh plan. Each delivered milestone's full text moves to
     <plan-name>.completed.md and leaves one block here. -->

### Milestone <N>: <Name> — delivered <YYYY-MM-DD>

**Delivered:** <one sentence: what exists now that didn't before>
**Tickets:** <id> <title> `<commit>` · <id> <title> `<commit>`
**Decisions that outlive this milestone:** none | <what later work is built on>
**Open advisories:** none | <non-blocking findings still true>
**Full detail:** [<plan-name>.completed.md](<plan-name>.completed.md)

---

## Milestone 1: <Name>

**Size:** S | M | L | XL
**Goal:** <what this milestone delivers on its own — should be independently
shippable/testable>
**Depends on:** none | Milestone <N>

### Ticket 1.1: <Title>

- **Status:** todo | in-progress | blocked | done
- **Size:** XS | S | M — anything larger is an unfinished decomposition; split it
- **Complexity:** trivial | mechanical | moderate | judgment-heavy
- **Agent tier:** `haiku` | `sonnet` | <the session's own model ID, for
  judgment-heavy> — every ticket is delegated; the tier is passed explicitly
- **Estimate:** `<tags>` · stack `<stack>` · <baseline | confident | escalate |
  split> <misses>/<attempts> <· tier haiku→sonnet> — from
  `scripts/estimate.mjs`; `qoq execute` reports the outcome back against exactly
  these tags and the **Agent tier** above
- **Escalation:** none | <failed tier> ×<attempts> → re-dispatched at <tier>
- **Depends on:** none | Ticket <id>
- **Needs approval:** none | <new dependency and why it's needed>
- **Files:**
  - Create: `exact/path/to/file.ts`
  - Modify: `exact/path/to/existing.ts:120-140`
  - Test: `exact/path/to/file.test.ts`

**Context:** Everything a zero-context subagent needs to do this without asking
questions — relevant types/interfaces, the existing pattern to follow, why this
ticket exists. No "similar to Ticket 1.3" — restate what's needed.

**Acceptance criteria:**

<!-- Written as assertions, not tasks. `qoq execute` opens this ticket by
     transcribing each one into a failing spec before any implementation, so
     each must describe observable behaviour a spec can assert today. -->

- [ ] <a 6th request inside 60s returns 429>
- [ ] <an expired token yields 401 with code TOKEN_EXPIRED>

**Definition of done:** <!-- the orchestrator's checklist, not the developer's;
     the dispatch carries Context, Files and Acceptance criteria only -->

- [ ] Acceptance criteria met, each with the spec that asserts it, raised to
      `test-conventions.md` by the developer itself
- [ ] `qoq fix <files above>` → PASS — run from the orchestrating thread, since
      the developer can't dispatch it
- [ ] Change committed after that PASS; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:** <filled in after the gate runs, or "none">

**Commit:** <filled in after commit — short hash, or a link if the remote is a
known host; "none" until then>

### Ticket 1.2: ...

### Milestone 1 — Definition of done

- [ ] All tickets above are `done`
- [ ] `qoq refactor --decisions auto <union of every ticket's Files above>` →
      clean. This is the milestone's refactor beat, and the only scope
      where cross-ticket findings — duplication, a now-dead export, three tickets
      that each picked a different shape — are visible at all. Pass the union
      explicitly; bare, it widens to the whole project
- [ ] Project's full build + full test suite green (the Commands header above,
      not the scoped variants a ticket gate uses)
- [ ] Milestone archived: full text moved to `<plan-name>.completed.md`, summary
      block left under `## Completed`, downstream tickets' **Context** updated
      with anything this milestone actually established

---

## Milestone 2: ...
```

## The archive file

`./plans/<same-plan-name>.completed.md` holds the milestones that have shipped,
verbatim as they were at delivery — tickets, context, acceptance criteria,
advisories, commits. It's append-only history, not a working document: nothing in
it is ever re-planned or re-gated.

```markdown
# <Feature Name> — completed milestones

Archived from [<plan-name>.md](<plan-name>.md). Append-only.

---

## Milestone 1: <Name> — delivered <YYYY-MM-DD>

<the milestone's full text, exactly as it read in the plan at delivery>
```

## Field notes

- **Acceptance criteria** are the field this whole template turns on. They're
  machine-facing: the implementing agent transcribes them one-to-one into failing
  assertions before writing any code. "Add rate limiting to the auth routes" is a
  title, not a criterion — it leaves the red beat with nothing to transcribe and
  the agent ends up inventing the assertion it should have been handed. If a
  criterion can't be asserted before the implementation exists, the ticket isn't
  decomposed yet.
- **Commands** are the project's _full_ build and test commands, copied from the
  discovery record at approval. The milestone gate runs them, possibly days later
  in a session with no memory of this one. There's no fallback to reading
  `package.json` — if these are missing, the plan was never properly approved.
- **Complexity** rates the model tier and nothing else. Every ticket runs the
  identical steps; an inflated rating costs a bigger model and no extra passes.
- **Plan status** tracks the whole plan; **Ticket status** tracks one ticket.
  A plan can be `in-progress` while individual tickets are still `todo`.
- **Estimate** is the calibration bucket this ticket's size and tier were drawn
  from, and it has to survive into execution: `qoq execute` reports the outcome
  back against these exact tags, this stack and the **Agent tier** above, and an
  outcome filed against anything else grades a decision nobody made. The target
  is 90–100%; below it the tier has already been bumped a rung, above it the
  estimator is proposing one rung down to check the work isn't being
  over-served. Either move is surfaced at approval, because whether this ticket
  really is the same shape as the ones behind that number is the user's call.
- **Escalation** stays `none` unless a dispatch actually handed the ticket back
  and it was re-dispatched a rung up. Fill it in even when the escalated run then
  passes — it's how a resume knows not to retry the tier that already failed, and
  how the user sees which tickets were mis-rated. The ladder stops at the
  orchestrator's own model; no tier above it exists to record.
- **Needs approval** is only present when decomposition surfaced a genuine
  new-dependency need. Omit it otherwise rather than leaving a dangling field on
  every ticket.
- **Files** paths are exact, not descriptive ("the auth module" is not a path). A
  subagent picking up a ticket cold should never have to grep the repo to find
  out what "the relevant file" means. There's no separate test-only ticket type
  for feature work — a ticket that ships a feature lists its spec files here and
  carries them as its own red beat.
- **Size** stops at `M`. There is no `L` ticket: more than 5 files, or crossing a
  subsystem boundary, means the decomposition isn't done. Milestones use
  `S`/`M`/`L`/`XL`, where `XL` means it should be its own plan.
- **Context** is the field most often shortchanged. "Similar to Ticket 1.3" or
  "handle edge cases" is a placeholder — go back and write the actual content.
- **Commit** is only ever filled in after a real commit exists. Never guess a
  hash.
- **Completed** is absent from a fresh plan and grows one short block per
  delivered milestone, so the plan shrinks as work lands. If a block starts
  turning into a narrative, move the detail to the archive file. **Decisions that
  outlive this milestone** is the one line worth real thought — it's what a later
  milestone would otherwise contradict.
