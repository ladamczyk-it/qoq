# External review lenses — `review` & `refactor` only

Of the seven shared dimensions in [analysis.md](analysis.md), two are — for
`review` and `refactor` only — delegated to third-party skills instead of
being reasoned about by qoq's own engine. **`fix` and `gate` are unaffected:**
neither this file nor the change it documents touches them; they still run
every one of the seven dimensions, design patterns included, straight through
[analysis.md](analysis.md#design-patterns--patternspatch) exactly as before.

This file is the single owner of what changes for `review`/`refactor`: what
each lens covers, how to tell it's installed, how to invoke it, what tier to
run it on, and how its findings become qoq's own patches. [review.md](review.md)
and [refactor.md](refactor.md) each just point here and add only what's
specific to their own scope — don't restate this mechanism in either of them.

## Table of contents

- [The two lenses](#the-two-lenses)
- [Model tiering](#model-tiering)
- [Checking availability first](#checking-availability-first)
- [Dispatching a lens](#dispatching-a-lens)
- [Turning findings into patches](#turning-findings-into-patches)
- [Where the new patch fits in the apply order](#where-the-new-patch-fits-in-the-apply-order)
- [Open question — not decided here](#open-question--not-decided-here)

## The two lenses

| Lens                                                | Delegates to                                                | Covers                                                                                                                                                                         | Mode                                                                                                                         | Reports                                                      |
| --------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **A — minimalism / over-engineering**               | `ponytail-review` (ponytail family)                         | unnecessary abstraction, speculative generality, YAGNI violations                                                                                                              | its own default review mode                                                                                                  | findings only — location, what to cut, what would replace it |
| **B — correctness / design-pattern / architecture** | `design-pattern-review` (`sirius-zuo/design-pattern-skill`) | 35+ patterns: GoF creational/structural/behavioral, modern patterns (Repository, CQRS, Circuit Breaker), architectural patterns (Hexagonal, Clean Architecture, Microservices) | its **code-review mode** — reviewing code that already exists, not the design-doc-review mode that proposes one from scratch | findings only, same shape as Lens A                          |

Neither lens applies its own fix — that stays qoq's job, same as every other
dimension.

Both lenses run **once over the whole scope the command resolved** — the diff
for `review`, the resolved file list for `refactor` — not divided per
code-area slice the way the internal six-dimension engine fan-out is. A lens
skill manages its own internal traversal of that scope; qoq's job is only to
hand it the scope and collect what comes back.

This replaces what the design-patterns dimension used to do internally for
these two commands only: `patterns.patch` for `review`/`refactor` now comes
from Lens B's findings, not from a from-scratch read of
[design-patterns.md](design-patterns.md). Lens A's minimalism findings are new
— neither command had a dedicated over-engineering dimension before this
change.

## Model tiering

The orchestrator (scoping, fan-out, merge, gate/policy) always runs on the
default agent, same as every other qoq subagent dispatch. Only the two lens
calls themselves are tiered, and each tier lives in exactly one place — this
table, not a value re-decided at each call site — so either row can move
once evals justify it. No separate settings file exists for this; the table
below **is** the single source of truth:

| Named point    | Lens                    | Tier                 | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------- | ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lens.A.model` | `ponytail-review`       | `haiku` (cheap tier) | Settled — ponytail's own published benchmarks were run on Haiku 4.5 and held up well.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `lens.B.model` | `design-pattern-review` | `sonnet` (default)   | Tried on `haiku` 2026-07-27 against 4 ground-truth fixtures (obvious pattern violation, clean code, over-applied single-impl pattern, a cross-file "looks needless until you check both real call sites" trap). Haiku matched Sonnet on the first three, including correctly declining to recommend a factory for one implementation. On the trap case it reached the same top-line recommendation but justified it with an invented "2^6 untested combinations" risk instead of the two real call sites actually in scope — Sonnet grounded the same recommendation in the real duplicate-literal evidence and, unprompted, said a second structural observation _didn't_ need a pattern yet. Single-sample, 4-fixture test — suggestive, not a statistically firm result. Keep `sonnet` until a larger multi-trial run confirms the gap closes. |

`lens.A.model` / `lens.B.model` are names for the two rows above, referenced
so the rest of this file (and [Dispatching a lens](#dispatching-a-lens) below)
can point at "the tier for Lens A/B" without repeating the reasoning — not
keys into any actual settings file. Pass the tier straight through as the
`model` parameter of the Task dispatch below; don't scatter the choice across
multiple call sites.

## Checking availability first

Before dispatching either lens, confirm it's actually installed — dispatching
into a skill that isn't there just burns a subagent to report back "not
found." The check is cheap: the list of installed skills already available to
you (the same listing that told you `qoq` itself is available) either names
`ponytail-review` / `design-pattern-review` or it doesn't. Check both, once,
before Phase 2's fan-out — not per-worker.

**That listing is a hint, not a guarantee the dispatch will succeed.** A lens
can look installed and still fail when you actually invoke it via the Skill
tool (an `Unknown skill: <name>` error is the observed failure mode). Treat a
failed dispatch exactly like a missing lens — the same four steps below apply
— and never work around it by reading the lens's own `SKILL.md` yourself and
improvising its analysis under its name. A self-produced approximation is not
that skill's finding; presenting it as one misattributes a guess as delegated
analysis and defeats the entire point of delegating instead of reasoning
about it in-house. If the dispatch fails, report the exact tool error and let
the four steps below decide what happens next — don't have the dispatched
worker decide on its own to substitute something else.

If a lens is **missing** (not installed, or its dispatch failed per above):

1. **Say so plainly** — name the missing skill and that it's required for
   this lens of the review. Don't fan out to it silently and don't silently
   drop it either.
2. **Ask the user** whether to install it now or proceed without it. If you
   can see a concrete install path (a plugin marketplace entry, a known
   source you can point at), surface it; otherwise say you don't have one
   and let the user supply it.
3. **If they decline** — gracefully degrade. Run with whichever lens(es)
   remain available, and continue the internal six-dimension engine exactly
   as normal (it's independent of both lenses). Do **not** fail the whole
   command over one missing lens.
4. **Mark the skip clearly** in the Phase 3 plan and the final summary — a
   reader comparing two review runs needs to know one ran with only one lens.

## Dispatching a lens

Once a lens is confirmed available, dispatch it via the Task tool:

- `subagent_type`: `general-purpose` (no dedicated registered agent for a
  third-party skill).
- `model`: the tier from the table above.
- Prompt: invoke the lens skill (by name, via the Skill tool) in the mode
  named above, over the exact scope you resolved (the diff's file list, or
  refactor's resolved file list — paste it in, don't make the worker
  re-derive it). Ask it to **report findings only, inline in its response** —
  location, what's wrong, what would resolve it — and to make **no edits**.
  It is a review lens here, never a fixer.
- **Some lenses have their own file-writing side effect independent of
  editing the reviewed code** — `design-pattern-review` documents that it
  writes its own report to `docs/review/<date>-*.md` by default. Explicitly
  ask the worker to skip that and return the findings inline instead; if the
  lens has no way to suppress it, treat whatever it writes as something this
  run is now responsible for — note it in the Phase 3 plan and clean it up
  alongside `.qoq/` rather than leaving an untracked file the run never
  accounted for.

## Turning findings into patches

A lens hands back prose findings, not a patch — the same shape qoq's own
internal dimensions produce before they're staged. Convert each finding
into a patch exactly the way the internal engine does: edit the minimum fix
into the affected file(s) yourself (or via a `qoq-analyzer`-style worker), then
capture it with `stage-patch.mjs` ([workflow.md](workflow.md#staging-a-patch)).
Two named patches, so the rest of the pipeline (Phase 3 presentation, Phase 4
apply order) treats them like any other dimension:

- Lens A findings → `minimalism.patch`
- Lens B findings → `patterns.patch` — deliberately the same name
  [analysis.md](analysis.md)'s own design-patterns dimension would have used,
  so [workflow.md](workflow.md#applying-patches)'s canonical order stays
  meaningful for `review`/`refactor` without editing that file.

A lens returning nothing worth changing is a fine result, same as any other
dimension — say so and stage no patch for it.

## Where the new patch fits in the apply order

[workflow.md](workflow.md#applying-patches)'s canonical dimension order
(`spellings` → `dependencies` → `complexity` → `copy_paste` → `conventions` →
`patterns` → `typescript`) doesn't know about `minimalism.patch` — it predates
this change and `fix`/`gate` don't produce that patch, so it isn't added
there. For `review`/`refactor` specifically, apply it **last**, after
`typescript.patch`: it's the newest, least-precedented lens, and a minimalism
fix is the one most likely to touch code another dimension's patch already
reshaped.

## Open question — not decided here

Should `refactor`'s step of turning a Lens B pattern-adoption suggestion (or
any other dimension's fix) into an actual patch also run the broader
`ponytail` YAGNI ladder — not just `ponytail-review`'s review-only lens — as a
sanity check on the new code it's about to introduce, not just the code it's
removing? This spec doesn't settle it either way; treat it as unresolved
rather than picking a default.
