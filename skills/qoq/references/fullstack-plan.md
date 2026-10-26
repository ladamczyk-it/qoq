# `qoq fullstack-plan` — one plan across components that ship together

`qoq fullstack-plan <requirements>` plans one feature across several qoq
projects that only work together — a UI and the API it calls. It writes one
**manifest** at the workspace root and one ordinary plan per component, and the
component plans can then be executed in parallel up to the points where one
genuinely needs another's delivered work.

It is [`plan.md`](plan.md)'s three phases run twice: once over the journey and the
boundary, here, then once per component, unchanged. This file only says what's
different. Execution is [fullstack-execute.md](fullstack-execute.md).

## What counts as a component

A child directory of the workspace root with its **own `qoq.config.*` and its
own `.git`**. `entry.mjs` lists the candidates in its `components` section;
confirm the set with the user before anything else — a sibling repo that happens
to be there is not automatically part of this feature.

Stop and say so when:

- **fewer than two** take part → it's a `plan`, run it inside that component
- a part shares one git index with another (a monorepo with `be/` and `fe/`
  under one `.git`) → unsupported. Two tracks committing into one index is the
  failure `execute`'s no-parallel rule exists for, and nothing here isolates it.

The root runs **no CLI and has no record**. Every command field, every estimate
and every gate belongs to a component, and is read from that component's record
when its own sub-plan starts.

## The rule everything here follows from

**No ticket ever spans two components.** `plan.md`'s size rule already says a
ticket crossing a subsystem boundary isn't decomposed; across repos it can't
even be committed. What crosses the boundary is the **contract**, and this
command exists to settle it once, before either side plans against it.

## Phase 1 — Scope, at journey level

Read the requirements and run `grilling` exactly as `plan.md` says, with one
change of altitude: the questions are about what the **user observes end to end**
and **which component owns which part of it** — not about any one codebase.
Component-level gaps are left for the component's own round, where its code is
in view.

Output, both onto the manifest:

- **Scenarios** — the feature's journeys, `plan.md`'s shape. These are what the
  E2E delivery milestone will prove at the end.
- **Ownership** — per scenario, the components it touches.

## Phase 2 — Design the boundary, and nothing else

One `Explore` across the components' **boundary code** only — the provider's
routes, handlers and schemas; the consumer's client, its types, its fetch
layer. Then one `qoq-architect`, carrying the Scenarios, Explore's findings and
this instruction: its scope is the **interface between components**, not either
component's internals.

What lands on the manifest:

- **Contracts** — the cross-component interface, inline or as a path to an
  `openapi.yaml` / zod schema one side already keeps. Same rule as a milestone's
  `Contracts`: a spec on either side can assert against it.
- **Roles** — per component, **provider** or **consumer** of each contract.

Ask the Unknowns here, before any component plans. A contract changed after
both sides have tickets against it is two replans.

The skip condition from `plan.md` doesn't apply: a feature that needs this
command has crossed a boundary by definition.

## Phase 3 — Slice, order, and draw the barriers

**One brief per component** — its slice of the requirements, the scenarios it
touches, its role in each contract, and everything settled so far. The brief is
that component's requirements in the next step; anything left out of it is a
gap its own grill will have to reopen.

**Order the components providers first.** A provider's milestones are what
consumers wait on, so they're planned first and the consumer is planned knowing
exactly what it will be waiting for.

**Barriers are drawn narrowly.** A consumer milestone that only needs a
contract's _shape_ builds against it — fixtures, a typed fake — and waits on
nothing. A barrier is a consumer milestone that needs the provider's
**delivered behaviour**, and it's written as `Depends on: <component>:Milestone
<N>`. Every barrier added is a point where the tracks stop running in parallel;
each one gets a reason on the manifest.

**Name the E2E owner** — the most-dependent component, the one whose journeys
can't be shown without the others (the UI, for UI↔API).

**Write the manifest now** — `<root>/plans/YYYY-MM-DD-<feature>.md`, from
[../assets/fullstack-template.md](../assets/fullstack-template.md), `Plan
status: draft`. Every component plan's **Orchestration** header points at it,
and a contract change in Phase 4 lands in it first, so it has to exist on disk
before the first component is planned.

## Phase 4 — Each component, in that order

Per component, the full `plan.md`, from inside it:

1. `node <skill>/scripts/discovery-check.mjs --project <component>`; fill the
   record per [discovery.md](discovery.md) if stale.
2. Phases 1–3 with the **brief as the requirements**. The grill is handed
   everything the manifest settled, so it opens only on what this codebase
   raises. A **fresh** `Explore` and a **fresh** `qoq-architect`, scoped to the
   component — never the boundary architect continued, whose context sits at
   the wrong altitude and grows with every component.
3. **The manifest's Contracts are fixed input** to this architect. A change it
   needs comes back as an **Unknown**; ask it, and if the answer changes the
   contract, update the manifest file and re-check every component already planned
   against it before going on. Never edit a contract inside one component.
4. Estimates with `estimate.mjs --project <component>` — calibration is per
   repo, and so is its store.
5. Save `<component>/plans/YYYY-MM-DD-<feature>.md`, `Plan status: draft`, with
   the template's **Orchestration** header pointing at the manifest. Every
   **Files** path is relative to the component (`src/…`, never `api/src/…`):
   its plan executes from inside it.

The E2E owner's plan ends on one more milestone, **E2E delivery**: the
manifest's Scenarios as its own, `Depends on` every other component's last
milestone. Its tickets are whatever proving those journeys needs in that repo —
it's planned and gated like any other milestone.

## Approval, once, for the set

Ask once. Surface `plan.md`'s approval items per component, plus the **barrier
table** and **which tracks can start immediately**.

On approval, every component plan gets `Plan status: approved` and its own
**Commands** header from its own record, then the manifest does.

`--tool` exports **each component plan** through `plan.md`'s beat; the manifest
is never exported.

Then offer `qoq execute <root>/plans/<file>.md`. Never dispatch a ticket from
here.

## Replanning

A component's `qoq replan` stays inside that component. Anything that touches the
manifest's **Contracts** or a **barrier** is `qoq fullstack-plan
<root>/plans/<file>.md` — this command over the existing manifest, under
[replan.md](replan.md)'s frozen/live split in every component plan it touches:
the contract first, then each component planned against it, providers first.
