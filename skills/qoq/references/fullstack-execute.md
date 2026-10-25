# `qoq execute` on a fullstack manifest

`qoq execute <root>/plans/<file>.md` where the file is a manifest written by
[fullstack-plan.md](fullstack-plan.md) — it has a **Components** table. Each
component plan is still delivered by [execute.md](execute.md), unchanged; this
file only decides **which track runs next, and where**.

## The board

```bash
node <skill>/scripts/progress.mjs <root>/plans/<file>.md
```

It reads every component plan **fresh from disk** through the manifest's
Components table — another session may have archived a milestone a minute ago —
and prints, per track, the same board `execute.md` shows for one plan, headed by
its **next milestone**: **ready**, **waiting on** `<component>:Milestone <N>`
(not under that plan's `## Completed` yet), or **done**.

Show it verbatim before anything else, and again whenever the next track is
chosen. It is the whole status of the feature; the manifest itself holds none.

## Ask how to run it

Never assume one:

- **Drive here** — this session runs the tracks one milestone at a time.
- **Fan out** — one session per component, in parallel. Print, per ready track:
  `cd <component> && claude`, then `/qoq execute plans/<file>.md`. Waiting
  tracks get their line too, marked with what they wait on — `execute.md`'s
  barrier check stops them there by itself. Re-running this command later just
  shows the board again — the way to watch a fan-out from the root.

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
   says holds there exactly; the component's plan file is the state.
3. Re-run the board — on the manifest, not the component — show it, and go
   again. Inside the milestone, `execute.md`'s own progress beats show that
   component's board as usual.

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
