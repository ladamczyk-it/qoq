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
**Plan status:** draft | approved | in-progress | complete

---

## Milestone 1: <Name>

**Size:** S | M | L | XL
**Goal:** <what this milestone delivers on its own — should be independently
shippable/testable>
**Depends on:** none | Milestone <N>

### Ticket 1.1: <Title>

- **Status:** todo | in-progress | blocked | done
- **Size:** XS | S | M | L
- **Complexity:** trivial | mechanical | moderate | judgment-heavy
- **Agent tier:** <cheapest-capable subagent> | main-thread
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
- [ ] `testing-gate` run over the files above
- [ ] `qoq gate <files above>` → PASS
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:** <filled in after gate runs, or "none">

### Ticket 1.2: ...

### Milestone 1 — Definition of done

- [ ] All tickets above are `done`
- [ ] Full quality suite: `qoq gate` (no explicit paths, full milestone
      scope) → PASS
- [ ] Project's full build + full test suite green (not the scoped commands)

---

## Milestone 2: ...
```

## Field notes

- **Plan status** tracks the whole plan; **Ticket status** tracks one ticket.
  Don't conflate them — a plan can be `in-progress` while individual tickets
  are still `todo`.
- **Needs approval** is only present on a ticket when decomposition surfaced
  a genuine new-dependency need. Omit the line entirely (or write `none`)
  otherwise — don't leave a dangling field on every ticket "just in case".
- **Files** paths are exact, not descriptive ("the auth module" is not a
  path). A subagent picking up a ticket cold should never have to grep the
  repo to find out what "the relevant file" means.
- **Context** is the field most often shortchanged. If you catch yourself
  writing "similar to Ticket 1.3" or "handle edge cases", that's a
  no-placeholder-scan failure — go back and write the actual content.
