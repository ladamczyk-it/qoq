# Plan template

Copy this structure verbatim for every new plan file — the fixed shape is
what lets an orchestrator resume a plan across sessions and lets a subagent
trust that "Status" and "Definition of done" mean the same thing in every
ticket it's ever handed. Fill in the `<…>` placeholders; don't add or remove
sections.

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
- **Escalation:** none | <failed tier> ×<attempts> → re-dispatched at <tier>
- **Depends on:** none | Ticket <id>
- **Needs approval:** none | <new dependency and why it's needed>
- **Files:**
  - Create: `exact/path/to/file.ts`
  - Modify: `exact/path/to/existing.ts:120-140`
  - Test: `exact/path/to/file.test.ts`

**Context:** Everything a zero-context subagent needs to do this without
asking questions — relevant types/interfaces, the existing pattern to follow,
why this ticket exists. No "similar to Ticket 1.3" — restate what's needed.

**Acceptance criteria:**

- [ ] <concrete, testable condition>
- [ ] <concrete, testable condition>

**Definition of done:**

- [ ] Acceptance criteria met
- [ ] `testing-gate` run over the test files above — include this line only on
      a **test-only** ticket, where **Files** lists nothing but `Test:`
      entries; omit it entirely otherwise. A ticket that ships a feature plus
      its tests has the implementer write those tests, and `qoq gate` covers
      them
- [ ] `qoq refactor <files above> --tree dirty --decisions auto --run <ticket
id>` standards pass run before the gate — include this line only on a
      **moderate** or **judgment-heavy** ticket; omit it on trivial,
      mechanical, and test-only ones, where the wide lens has no decision to
      review and the milestone gate covers the code anyway
- [ ] `qoq gate <files above> --run <ticket id>` → PASS
- [ ] Change committed; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:** <filled in after gate runs, or "none">

**Commit:** <filled in after commit — short hash, or a link if the remote is
a known host; "none" until then>

### Ticket 1.2: ...

### Milestone 1 — Definition of done

- [ ] All tickets above are `done`
- [ ] Full quality suite: `qoq refactor <union of every ticket's Files above>
--decisions auto --run milestone-<N>` → clean. `refactor` rather than
      `gate`, because this is the only scope where cross-ticket findings
      (duplication, a now-dead export, three tickets that each picked a
      different shape) are visible at all. Pass the union explicitly — bare, it
      widens to the whole project
- [ ] Project's full build + full test suite green (not the scoped commands)
- [ ] Milestone archived: full text moved to `<plan-name>.completed.md`,
      summary block left under `## Completed`, downstream tickets' **Context**
      updated with anything this milestone actually established

---

## Milestone 2: ...
```

## The archive file

`./plans/<same-plan-name>.completed.md` holds the milestones that have
shipped, verbatim as they were when delivered — tickets, context, acceptance
criteria, advisories, commits. It's append-only history, not a working
document: nothing in it is ever re-planned or re-gated.

```markdown
# <Feature Name> — completed milestones

Archived from [<plan-name>.md](<plan-name>.md). Append-only.

---

## Milestone 1: <Name> — delivered <YYYY-MM-DD>

<the milestone's full text, exactly as it read in the plan at delivery>
```

## Field notes

- **Commands** are the project's _full_ build and test commands, exactly as
  Phase 1's discovery reported them — not the scoped single-file variants a
  ticket gate uses. The milestone gate runs them, in a session that may be days
  later and has no memory of discovery. Writing them down here is the only
  thing that keeps them from being re-derived or guessed.
- **Plan status** tracks the whole plan; **Ticket status** tracks one ticket.
  Don't conflate them — a plan can be `in-progress` while individual tickets
  are still `todo`.
- **Escalation** stays `none` unless a dispatch actually handed the ticket
  back ("This feels too complex for me") and it was re-dispatched a rung up.
  It's how a resume knows not to retry the tier that already failed, and how
  the user sees which tickets were mis-rated — so fill it in even when the
  escalated run then passes. The ladder stops at the orchestrator's own
  model; no tier above it exists to record.
- **Needs approval** is only present on a ticket when decomposition surfaced
  a genuine new-dependency need. Omit the line entirely (or write `none`)
  otherwise — don't leave a dangling field on every ticket "just in case".
- **Files** paths are exact, not descriptive ("the auth module" is not a
  path). A subagent picking up a ticket cold should never have to grep the
  repo to find out what "the relevant file" means.
- **Size** stops at `M`. There is no `L` ticket: more than 5 files, or
  crossing a subsystem boundary, means the decomposition isn't done yet.
  Milestones still use `S`/`M`/`L`/`XL`, where `XL` means it should be its
  own plan.
- **Context** is the field most often shortchanged. If you catch yourself
  writing "similar to Ticket 1.3" or "handle edge cases", that's a
  no-placeholder-scan failure — go back and write the actual content.
- **Commit** is only ever filled in after a `PASS` produces a real commit —
  never guess a hash or fill this in before the commit exists.
- **Completed** is absent from a fresh plan and grows one short block per
  delivered milestone. It exists so the plan shrinks as work lands: if a
  block starts turning into a narrative, move the detail to the archive file
  where it belongs. **Decisions that outlive this milestone** is the one line
  worth real thought — it's what a later milestone would otherwise
  contradict.
