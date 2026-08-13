# Design Pattern Review — qoq

**Date:** 2026-08-13
**Mode:** Code review
**Scope:** the 18-file union of the ESLint `defineConfig` migration's Milestone 5
**Language:** TypeScript / JavaScript (Node ≥22.15.0, npm workspaces + Lerna)

## Project summary

Twelve `packages/eslint-v9-*` packages publish flat-config **delta layers** plus a
`configs.*` object of `defineConfig(...)` arrays composed linearly from each package's
whole ancestry. Composition is always built from delta layers, never from another
package's already-composed array — `defineConfig` does not dedupe diamond extends, so
re-applying a base mid-chain clobbers earlier layers' rule restorations.

Supporting tooling in scope: `scripts/config-diff.js` + `scripts/config-diff.resolver.mjs`
(cross-checkout resolved-config comparison), `qoq.config.js`, and the qoq skill's
`summarize.mjs` digest script.

## Verdict on the two questions asked

### 1. Delta-layer + linear composition — right pattern, keep it

This is a correctly applied **pipeline/decorator composition**, and the arrangement is
sound for a 12-package matrix. Each package contributes exactly one named delta and
declares its full ancestry explicitly at the composition site.

**The twelve near-identical order-guard specs do not signal a missing abstraction.**
They look like duplication and are not: what each asserts is a _different_ ordered list.
The specs are data, and the data is the thing under test.

More importantly, the explicitness is **load-bearing rather than incidental**. Because
`defineConfig` does not dedupe, the literal chain at each composition site is the safety
property — a reader can see the whole ancestry without following imports, and the bug
class this migration exists to fix (a base re-applied mid-chain) is visible on
inspection. A chain-builder abstraction would hide exactly the thing that must stay
visible. This is a case where repetition is cheaper than the indirection that would
remove it.

Note this also means the "twelve packages share a test helper" question was already
settled correctly for a second, independent reason beyond the published-contract
argument: even if coupling were free, the abstraction would be wrong here.

### 2. `scripts/config-diff.js` — sound shape, one real smell

The overall structure is right: a linear pipeline (worktree add → install → build →
resolve both trees → diff → report) with cleanup in `finally`, and the resolver isolated
as a self-contained subprocess because it must run inside a foreign checkout. That
subprocess boundary is a genuine constraint, not incidental complexity, and it is
correctly enforced (the resolver imports nothing outside itself).

**The one structural finding worth carrying forward** is `diffSnapshot`'s signature:

```js
const diffSnapshot = (
  context, refSnapshot, currentSnapshot,
  issues,                                  // mutated output param
  sanctionedRules, ruleAdditions,          // two halves of one concept
  expectedDeltas                           // mutated output param
) => {
```

Seven parameters, of which two are mutable accumulators passed in to be written to, and
two more are the two halves of a single "waiver policy". The function's real contract —
_given a snapshot pair and a waiver policy, produce issues and expected deltas_ — is not
visible in the signature.

This is a **Parameter Object** opportunity, not a rewrite: group `sanctionedRules` +
`ruleAdditions` into one waiver argument, and return `{ issues, expectedDeltas }` rather
than mutating arrays passed down two call levels.

**Severity: low.** The code is correct and tested through five negative probes. This is
maintainability, and it only starts to bite if a third waiver kind is ever added — which
is exactly when someone would otherwise add an eighth parameter.

## Other observations

### Naming asymmetry at the root of the chain

Eleven packages name their delta `<x>Layer` (`tsLayer`, `rtlLayer`, `vitestLayer`,
`tsVitestRtlLayer`, …). The root package exports its delta as `baseConfig`
(`packages/eslint-v9-js/src/index.ts:225`), so every composition site reads:

```js
defineConfig(
  jsBaseConfig,
  vitestLayer,
  rtlLayer,
  tsLayer,
  testLayer,
  tsVitestLayer,
  tsVitestRtlLayer
);
```

One of these is not like the others. It is historically explicable — the root's delta
_is_ the whole base, and Ticket 4.1 deliberately retained the name while redocumenting it
as the root delta layer — but it costs a reader a moment at all twelve call sites, and it
weakens the otherwise-uniform vocabulary the pattern depends on. Renaming to `jsLayer`
with `baseConfig` kept as a deprecated alias would be a breaking-change-adjacent cleanup
best folded into a future major, not done on its own.

**Severity: cosmetic.** Flagging for the record, not recommending action now.

### `summarize.mjs` — eight sections, one shape

`skills/qoq/scripts/summarize.mjs` (478 lines) runs eight sequential tool blocks that
each follow an identical arc: read a report, normalize it, accumulate a count, push a
formatted section. A table-driven arrangement (an array of tool descriptors, each with a
parse and a format function) would collapse a lot of it.

**Not recommended.** Each block's normalization genuinely differs — knip alone handles
two incompatible report shapes — and a descriptor table would push that variation into
per-tool callbacks, which is the same code with a layer of indirection on top. The flat
form is greppable and each section is independently readable, which is what a diagnostic
script needs. Worth revisiting only if a ninth and tenth tool arrive.

### Correctly applied, no action

- **`qoq.config.js`** — flat declarative configuration, no logic. Right shape.
- **`config-diff.resolver.mjs`** — self-containment is enforced by its deployment model
  (copied into a worktree), and the inlined constants are a consequence of that
  constraint, not copy-paste.
- **Waiver maps as enumerated data** — correct. A prefix match would be shorter and
  wrong; enumeration is what makes an unexpected rule fail.
- **`summarize.test.mjs`** — tests the digest through the subprocess boundary the real
  caller uses, and includes a negative case guarding against "prints everything" passing
  the positive tests. Well-shaped for its size.

## Recommendations

| #   | Finding                                                                       | Pattern                 | Severity      | Action                                  |
| --- | ----------------------------------------------------------------------------- | ----------------------- | ------------- | --------------------------------------- |
| 1   | `diffSnapshot` — 7 params, 2 mutable output args, waiver concept split in two | Parameter Object        | Low           | Follow-up ticket, not urgent            |
| 2   | Root delta named `baseConfig` while 11 siblings use `<x>Layer`                | Naming consistency      | Cosmetic      | Fold into a future major                |
| 3   | `summarize.mjs` eight-block repetition                                        | Strategy / table-driven | Informational | No action — indirection would cost more |

**Nothing here blocks the milestone.** The central architectural decision — delta layers
composed linearly, never from another package's composed array — is correct, and the
migration's own tooling verifies it against a real pre-migration checkout rather than a
frozen snapshot, which is a stronger guarantee than what it replaced.

## Anti-patterns checked and not found

- No god objects or oversized classes in scope
- No large conditional dispatch blocks (>5 cases)
- No scattered direct data access
- No speculative single-implementation interfaces
- No cross-cutting concerns tangled into composition logic
