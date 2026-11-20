# Plan template

A plan is a directory, `./plans/<YYYY-MM-DD-feature>/`: one `index.md` and one
`m<N>-<slug>.md` per milestone. The index is what a person opens and what a
resume reads first. A milestone file holds everything one milestone's run
needs, so `qoq execute` loads the index plus the one milestone it is working
on, never the whole plan. Nothing moves when a milestone ships. Its file stays
where it is, gains an **Outcome** block at the top, and its index row flips to
`delivered`.

Copy both shapes for every new plan. The fixed shape is what lets `qoq execute`
resume a plan across sessions, and what lets a cold subagent trust that
"Status" and "Definition of done" mean the same thing in every ticket it's ever
handed. Fill in the `<…>` placeholders; don't add or remove sections. The one
exception is **External**, which the `--tool` export writes onto milestones and
tickets after approval — and which `qoq execute --source` writes as it imports
them the other way. It's simply absent on a plan that never met a tracker.

## `index.md`

```markdown
# <Feature Name> Implementation Plan

**Goal:** <one sentence>
**Architecture:** <2-3 sentences>
**Requirements source:** <link or short description of what was decomposed>
**Commands:** build `<full build command>` · test `<full test command>`
**Tool:** local | jira | linear | trello · <destination — project key, team, or
board; omit the whole field on a local plan>
**Plan status:** draft | approved | in-progress | complete
**Docs conventions:** <absent until a `qoq-scribe` question is answered>
**Security context:** <absent until a `qoq-sheriff` question is answered>
**Review context:** <absent until a `qoq-reviewer` question is answered>
**Signed off:** <absent until the user signs off a reviewed run> <YYYY-MM-DD>
— <the user's note, or none>

## Diagrams

<!-- Absent unless qoq-artist drew something. Its charts only, each under a
     `qoq-artist id` marker. -->

## Milestones

| #   | Milestone              | Status   | Depends on | Summary    |
| --- | ---------------------- | -------- | ---------- | ---------- |
| M1  | [<Name>](m1-<slug>.md) | <status> | none       | <one line> |
| M2  | [<Name>](m2-<slug>.md) | <status> | M1         | <one line> |

## Retro

<!-- Absent unless a milestone had a retro. The final retro's merged lessons,
     written once the last milestone is delivered — see the field note. -->
```

A plan that is a repo's share of a feature also has a **Feature** header line
and a **Serves** column ([below](#a-repos-share-of-a-feature)).

**Status** is `todo` | `in-progress` | `delivered <YYYY-MM-DD>` |
`withdrawn — <why>`. **Summary** is the milestone's Goal in one line until it
ships, then its **Delivered** sentence.

## `m<N>-<slug>.md`

```markdown
# Milestone <N>: <Name>

Part of [<Feature Name>](index.md).

## Outcome

<!-- Absent until the milestone is delivered; written at the top so a person
     opening a shipped milestone reads what happened before how it was cut. -->

**Delivered:** <YYYY-MM-DD> — <one sentence: what exists now that didn't before>
**Tickets:** <id> <title> `<commit>` · <id> <title> `<commit>`
**Gate evidence:** refactor `green base <result>; A1 JSCPD <…>; A2 conventions
<…>; A3 ponytail-review <…>; A4 qoq-designer <…>` — each assessment's findings,
`none`, or `skipped — <why>` · suite `<the full build + suite result, as
reported>`
**Decisions that outlive this milestone:** none | <what later work is built on>
**Open advisories:** none | <non-blocking findings still true>
**Docs advisories:** none | <scribe drift, `qoq-scribe:` markers, docs skipped>
**Security:** clean | <S<n> <severity> —
remediated `<hash>` · accepted · deferred to <ticket> · open advisory>
**Review:** <absent unless the reviewer ran> clean | <R<n>·RS<n> <severity> —
remediated `<hash>` · accepted — <file>:'<anchor>' — "<reason>" · deferred to
<ticket> · open advisory>
**Retro:** <the whole line is absent unless the retro ran — a milestone with no
retried ticket has no Retro line, not a "none"> <n> code · <n> planning · <n>
skill lessons | ran, none worth recording

## Scope

**Size:** S | M | L | XL
**Goal:** <what this milestone delivers on its own — should be independently
shippable/testable>
**Depends on:** none | Milestone <N>
**Follow-up of:** <absent unless the final retro appended this milestone> retro
**Contracts:** none | <the interface this milestone's tickets share — inline when
small (a type, a payload shape, an error shape), or a path when the project
already keeps `openapi.yaml` / `.proto` / a zod schema>
**Scenarios:**

<!-- Journeys, in the user's language, written in Phase 1 from what the grill
     settled. Not assertions — see the field note. -->

- **Given** <the state the user is in> **When** <what they do> **Then** <what
  they observe>

**External:** <added by the export beat only — the epic/milestone/list it was
raised as; absent otherwise>

## Tickets

### Ticket <N>.1: <Title>

<!-- What a person reads: the spec. -->

- **Status:** todo | in-progress | blocked | done
- **Size:** XS | S | M — anything larger is an unfinished decomposition; split it
- **Depends on:** none | Ticket <id>
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
     each must describe observable behaviour a spec can assert today. Each box is
     ticked at `done` and gains its evidence pointer — see the field note. -->

- [ ] <a 6th request inside 60s returns 429> — `<spec/file.ts::test name>`
- [ ] <an expired token yields 401 with code TOKEN_EXPIRED> —
      `<spec/file.ts::test name>`

#### Execution

<!-- The orchestrator's: how this ticket is run and what happened. None of it
     goes into the developer's dispatch. -->

- **Complexity:** trivial | mechanical | moderate | judgment-heavy
- **Agent tier:** `haiku` | `sonnet` | <the session's own model ID, for
  judgment-heavy> — every ticket is delegated; the tier is passed explicitly
- **Estimate:** `<tags>` · stack `<stack>` · <baseline | confident | escalate |
  split> <misses>/<attempts> <· tier haiku→sonnet> — from
  `scripts/estimate.mjs`; `qoq execute` reports the outcome back against exactly
  these tags and the **Agent tier** above
- **Escalation:** none | <failed tier> ×<attempts> → re-dispatched at <tier>
- **Security sweep:** ticket — <absent unless proposed at plan time and confirmed
  at approval; absent means the milestone sweep only>
- **Needs approval:** none | <new dependency and why it's needed>

**Definition of done:** <!-- the orchestrator's checklist, not the developer's;
     the dispatch carries Context, Files, Acceptance criteria and the milestone's
     Contracts only -->

- [ ] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread,
      since the developer can't dispatch it
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2, after Gate 1
      because `qoq fix` rewrites formatting. No ticket is `done` without it: a
      ticket whose tests assert nothing files a `success` with the estimator and
      leaves downstream work built on a behaviour nothing pins
- [ ] Every acceptance criterion ticked with its evidence pointer, taken from the
      reviewer's criterion → assertion mapping
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:** <filled in after the gates run, or "none">

- **Log:**
  <!-- Orchestrator-written, append-only. One line per transition; no schema
       beyond a timestamp and what happened. -->
  - `<YYYY-MM-DD HH:MM>` dispatched @ <tier> (attempt <n>)
  - `<YYYY-MM-DD HH:MM>` qoq fix FAIL — <category> — <evidence>
  - `<YYYY-MM-DD HH:MM>` re-dispatched (attempt <n>)
  - `<YYYY-MM-DD HH:MM>` qoq fix PASS · tests approved
  - `<YYYY-MM-DD HH:MM>` done `<hash>`

**Commit:** <filled in after commit — short hash, or a link if the remote is a
known host; "none" until then>

**External:** <added by the export beat only — the issue key or card URL this
ticket was raised as; absent otherwise>

### Ticket <N>.2: ...

## Definition of done

- [ ] All tickets above are `done`
- [ ] `qoq refactor --decisions auto <union of every ticket's Files above>` →
      clean. This is the milestone's refactor beat, and the only scope
      where cross-ticket findings — duplication, a now-dead export, three tickets
      that each picked a different shape — are visible at all. Pass the union
      explicitly; bare, it widens to the whole project
- [ ] Project's full build + full test suite green (the index's Commands header,
      not the scoped variants a ticket gate uses)
- [ ] Sheriff on: `qoq-sheriff` over the milestone's diff, its findings routed
      and recorded on the Outcome block's **Security** line
- [ ] Review: `qoq-reviewer` (spec + standards) over the final diff, findings
      routed and recorded on the Outcome block's **Review** line
- [ ] Any ticket retried: `qoq-retro` over this file's Logs, its lessons
      written below as the Retro section and counted on the Outcome block's
      **Retro** line
- [ ] Both results written into the Outcome block's **Gate evidence** — what the
      refactor found and what the suite reported, not "green"
- [ ] Milestone delivered: Outcome block written at the top of this file, the
      index row set to `delivered <YYYY-MM-DD>` with the **Delivered** sentence
      as its Summary, later milestone files' ticket **Context** updated with
      anything this milestone actually established

## Retro

<!-- Absent unless the retro ran. qoq-retro's lessons, verbatim. -->

- L1 · <code | planning | skill> · <category> — <lesson> — from <ticket>
  attempt <n>: <the Log line> → <the change it proposes>
```

## Field notes

- **The directory** is the plan's name. `External` keys, a resume and
  `qoq replan` all address it by path, so it never moves and never gets a `.v2`;
  git is the history. Milestone numbers are never reused or renumbered, which
  is why a milestone file's `m<N>` stays true after a replan adds or withdraws
  one.
- **Status lives in one place per level.** A ticket's **Status** is written only
  in its milestone file; a milestone's only in the index row. The index carries
  no ticket counts, because a second copy is one a crashed run leaves wrong.
- **Ticket field order** is spec first, then **Execution**. The first half is
  what a person reviewing the plan reads and what the dispatch is built from;
  the second is the orchestrator's bookkeeping. Every field still exists — the
  split only decides which one a reader meets first.
- **Acceptance criteria** are the field this whole template turns on. They're
  machine-facing: the implementing agent transcribes them one-to-one into failing
  assertions before writing any code. "Add rate limiting to the auth routes" is a
  title, not a criterion — it leaves the red beat with nothing to transcribe and
  the agent ends up inventing the assertion it should have been handed. If a
  criterion can't be asserted before the implementation exists, the ticket isn't
  decomposed yet. Each one is derived from a **Scenario** — a criterion with no
  parent journey is one somebody invented.
- **Evidence pointer** is the `spec/file.ts::test name` written beside a
  criterion when the ticket reaches `done`, and it comes from
  `qoq-test-reviewer`'s mapping — never from the orchestrator's own reading of
  the diff, which is the reading the gate exists to replace. Without it a
  delivered plan reads identically to an undelivered one, and "criteria met" is a
  claim nobody can check without re-opening the diff.
- **Contracts** sits on the **milestone**, not the ticket: its tickets share one
  interface — one implements it, another asserts it — and milestone 3's schema
  has no business in milestone 1's dispatch context. It's written in Phase 2 from
  `qoq-architect`'s output, and `qoq execute` passes it verbatim into every
  dispatch. `none` is a normal, common value; say it out loud rather than
  inventing a schema section, which is what a mandatory field otherwise grows.
  The one rule on the content: it has to be something a spec can assert against,
  the same test acceptance criteria already pass.
- **Scenarios** are journeys, and a journey is not an acceptance criterion. A
  criterion is one ticket's assertion — "a 6th request inside 60s returns 429".
  A scenario spans tickets — "**Given** a signed-in user who has just hit the
  limit, **When** they retry after the window, **Then** the request succeeds and
  the counter has reset". Nothing else in the plan holds the second, and a
  milestone's whole claim is that it's independently shippable, which is a
  statement about journeys rather than about assertions. Structured prose, not
  Gherkin: the intended consumer is a model and needs no formal grammar, while
  real Gherkin invites someone to point Cucumber at it and then wants step
  definitions nobody asked for. More than about six means the milestone is too
  big — the same test the `XL` rule applies, reached from the other direction.
- **Log** is orchestrator-written and append-only — one line per transition, a
  timestamp and what happened. A failure line is the one with a fixed shape:
  gate, category, evidence, because it's all the retro reads. It exists because `Status`
  says where a ticket is and nothing says how it got there: two gate rejections
  and an escalation are invisible in a `done` ticket otherwise, and they're what
  a resume, and the user, read a plan's history from.
- **Commands** are the project's _full_ build and test commands, copied from the
  discovery record at approval. The milestone gate runs them, possibly days later
  in a session with no memory of this one. There's no fallback to reading
  `package.json` — if these are missing, the plan was never properly approved.
- **Docs conventions** and **Docs advisories** are written by `execute`'s
  document step, never by `plan`. The first is the user's answer to a
  `qoq-scribe` question, passed to every later dispatch so it's never asked
  twice; the second is what the scribe found that only the user can settle —
  plan-vs-delivery drift and purpose it couldn't determine.
- **Security context**, **Security sweep** and **Security** are the sheriff's.
  **Security** is always written, and the other two only when they apply. The
  first is the user's answer to a `qoq-sheriff` question, passed to every later
  sweep; the second is a plan-time proposal the user confirmed, buying a ticket
  an early sweep before its commit; the third records how every finding ended,
  which keeps an accepted risk visible to whoever reads the plan later.
- **Review context**, **Review** and **Signed off** are the reviewer's. The first is the user's answer to a `qoq-reviewer`
  question, passed to every later review. The second records how every finding
  ended. An accepted entry carries its anchor and reason because it's the only
  record of the acceptance: later reviews read it instead of a marker in the
  code. The third is the user's yes at the end of the plan.
- **Retro**, **Follow-up of** and both `## Retro` sections are the retro's
  (`references/retro.md`). A milestone file's section holds that milestone's
  lessons. The index's holds the merged ones from the end of the run, and
  whether the user took the follow-up milestone for the code ones.
  **Follow-up of** marks the one milestone the final retro may append. A plan
  that already has one never gets a second.
- **Diagrams** is `qoq-artist`'s, written into the index before approval when
  diagrams are on and absent otherwise. It lives in the index so no ticket
  dispatch carries it, and it records the shape that was approved: `execute`
  never redraws it, only `replan` does.
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
- **Tool** and **External** exist for the two beats that cross into a tracker
  (`references/export.md`): `qoq plan --tool jira|linear|trello` raises the
  milestones and tickets there after approval, and `qoq execute --source` reads
  a milestone back out into a plan directory shaped like this one. **External**
  is what makes both re-runnable — on export an item that already has one is
  skipped, so a second run after a crash adds what's missing instead of
  duplicating forty issues into a shared project; on an imported plan it's the
  address the run writes each ticket's status label and commit back to. A local
  plan carries neither field, which is the point: the files are the state in
  either direction, and `qoq execute` never treats a tracker as one.
- **Outcome** is absent from a fresh milestone file and written once, at
  delivery, above **Scope**. It is history, not a working document: nothing in a
  delivered milestone file is ever re-planned or re-gated, and the only later
  edit it takes is a Security or Review line updated by the end-of-run
  walkthrough. If it starts turning into a narrative, the detail belongs in the
  tickets' Logs below it. **Decisions that outlive this milestone** is the one
  line worth real thought — it's what a later milestone would otherwise
  contradict.

## A repo's share of a feature

The repo sits in a parent folder with its sibling repos, next to `feature.json`,
`feature/<slug>/brd.md` and `contracts/`. That folder belongs to the chief of
staff. This plan touches only its own repo and `contracts/`.

- **Header:** `**Feature:** <slug> · ../feature/<slug>/brd.md`, below **Tool**.
- **Milestones table:** a **Serves** column after **Depends on**, naming the
  master milestones from the BRD that the row serves (`M1`, `M1, M2`). The
  **Depends on** cell may name another repo's milestone as `<repo>:M<N>`, using
  the repo `name` from `feature.json`.
- **`../contracts/<name>.md`**, written by the providing repo once its plan is
  approved:

```markdown
# Contract: <name>

**Provider:** <repo>:M<N>
**Consumers:** <repo>, <repo>

<the provider milestone's Contracts field, verbatim>
```

`scripts/feature-status.mjs` reads these columns by their header names, so keep
them exactly as written.
