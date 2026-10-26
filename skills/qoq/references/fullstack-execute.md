# `qoq execute` on a fullstack manifest

`qoq execute <root>/plans/<file>.md` where the file is a manifest written by
[fullstack-plan.md](fullstack-plan.md) — it has a **Components** table. Each
component plan is still delivered by [execute.md](execute.md), unchanged; this
file only decides **which track runs next, and where**.

## The board

Load every component plan **fresh from disk**, through the manifest's
Components table, every time you need the answer — another session may have
archived a milestone a minute ago. Per track:

- its **next milestone** — the first not under `## Completed`
- **ready**, or **waiting on** `<component>:Milestone <N>` — a milestone whose
  `Depends on` names another component is ready only once that milestone sits
  under the other plan's `## Completed`
- **done**, when its plan is `complete`

Print it before anything else, one line per track. It is the whole status of
the feature; the manifest itself holds none.

## Ask how to run it

Never assume one:

- **Drive here** — this session runs the tracks one milestone at a time.
- **Fan out** — one session per component, in parallel. Print, per ready track:
  `cd <component> && claude`, then `/qoq execute plans/<file>.md`. Waiting
  tracks get their line too, marked with what they wait on — `execute.md`'s
  barrier check stops them there by itself. Re-running this command later just
  shows the board again.

Fan-out is the only parallel path. A single session never has two tracks in
flight: each repo's gates answer "did _this_ change break it?" only while one
writer is in it, and this thread is the one writer in drive mode.

## Drive here

Loop until every track is done, or none is ready:

1. Pick a **ready** track — the one others are waiting on first, then manifest
   order.
2. Run `execute.md` for **that component's next milestone**, from inside it:
   its discovery (`discovery-check.mjs --project <component>`), its branch
   check, its tickets, its milestone gate and archive. Everything `execute.md`
   says holds there exactly; the component's plan file is the state. This
   thread still sits at the root, so **every script call carries `--project
<component>`** — `estimate.mjs --record` included, or the outcome lands in
   whichever directory the shell is in, not that repo's calibration store.
3. Re-derive the board and go again.

**An `in-progress` ticket on a track you're about to drive is a question**, not
a dead run to reconcile: in a fan-out it may be a live session in that repo.
Ask before touching it.

**No track ready and some not done** is a stop, never a wait. Say which track
is blocked on which, and on what — usually a `blocked` ticket upstream.

## Contract trouble

A `plan` handoff in any track whose answer would change the manifest's
**Contracts** stops that track and goes back to `qoq fullstack-plan` over the
manifest. Answering it inside one component leaves the other side asserting
against a contract that no longer exists.

## Done

When every component plan is `complete` — the E2E owner's **E2E delivery**
milestone included — set the manifest's `Plan status: complete`. That's the
only write this command makes to the manifest, and it happens after every
writer has finished.
