# Analysis — the seven QoQ dimensions

The single definition of what QoQ looks for. `review` runs these dimensions
over a branch diff, `refactor` and `fix` over a chosen file set, `gate` over a
producer's just-changed files — the **scope** differs, the analysis does not.
Each dimension yields at most one patch (staged per
[workflow.md](workflow.md#staging-a-patch)), containing the _minimum_ change,
written to the project's own standards. The TypeScript-idioms dimension applies
only to TS code — skip it for plain JavaScript.

Only analyze the scope the command resolved. The point is to evaluate _that
code_, not to relitigate the whole codebase.

## Table of contents

- [Tool-backed findings via the engine](#tool-backed-findings-via-the-engine)
- [Quality over quantity — keeping vs. dropping a finding](#quality-over-quantity--keeping-vs-dropping-a-finding)
- [Risk tiers — safe vs. advisory](#risk-tiers--safe-vs-advisory)
- [Spelling & naming](#spelling--naming--spellingspatch)
- [Dependencies](#dependencies--dependenciespatch)
- [Complexity / SOLID](#complexity--solid--complexitypatch)
- [Copy-paste](#copy-paste--copy_pastepatch)
- [Code conventions](#code-conventions--conventionspatch)
- [Design patterns](#design-patterns--patternspatch)
- [TypeScript idioms](#typescript-idioms--typescriptpatch)
- [Quick reference](#quick-reference)

## Tool-backed findings via the engine

Four dimensions are backed by a tool. Get their findings from the engine
([engine.md](engine.md)) — prime the reports once, read the digest, never run
the linters ad hoc or load raw JSON:

```bash
npx qoq --check --json --output .qoq/reports
node <skill>/scripts/summarize.mjs .qoq/reports
```

| Dimension          | Digest section                          |
| ------------------ | --------------------------------------- |
| Spelling & naming  | ESLint (naming-convention rule)         |
| Dependencies       | Knip                                    |
| Complexity / SOLID | ESLint (`sonarjs/cognitive-complexity`) |
| Copy-paste         | JSCPD                                   |

`qoq` runs across the project's configured `srcPath`, not the command's scope —
so **filter the digest's findings down to the scope's files** before turning
anything into a patch. Knip dependency findings are project-wide by nature;
report only what the scope is responsible for. The remaining dimensions — code
conventions, design patterns, TypeScript idioms, spelling beyond identifiers —
have no tool behind them; handle those by reading the code. Per-tool fix
strategy and false-positive traps: [tool-playbook.md](tool-playbook.md). When
the project has no `qoq`, use each dimension's fallback from the
[quick reference](#quick-reference).

## Quality over quantity — keeping vs. dropping a finding

An empty result is a fine result. A finding earns a patch only when the fix
genuinely reduces a future reader's effort; recommend _dropping_
valid-but-low-value findings rather than padding the plan. Concretely:

> The digest flags `sonarjs/cognitive-complexity` (18 > 15) on
> `resolveConfig()`, and the same file has a `let tmp` holding a parsed config.
>
> **Keep** — `resolveConfig()` interleaves env-var parsing with file loading;
> extracting `readConfigFile()` drops complexity to 9 and each half now states
> its intent. The restructure is small, mechanical, and unambiguously reads
> better → `complexity.patch`.
>
> **Drop** — renaming `tmp` → `parsedConfig` is _valid_, but the variable
> lives for three lines directly under `JSON.parse(...)`, so the name adds
> nothing a reader doesn't already see. Say so in the plan ("skipped: rename
> adds no clarity over the three-line context") and stage no patch.

The second half matters as much as the first: stating _why_ a finding was
dropped is what keeps the standard predictable instead of arbitrary.

## Risk tiers — safe vs. advisory

Two commands need to know, per finding, whether it's mechanical enough to act
on without asking or whether it needs a human's judgment: `gate` (auto-applies
one tier, only reports the other) and `fix` (stages both as patches, but
treats them differently in Phase 3's approval). This is the **single
definition** of that split — [gate.md](gate.md) and [fix.md](fix.md) each add
only what's specific to how they _use_ it, not a second copy of the list.

- **Safe tier** — mechanical or high-confidence, rarely changes behavior:
  - Formatting (`qoq --fix` / Prettier) and the auto-fixable ESLint/Stylelint
    rules.
  - Spelling and naming-convention fixes.
  - Code conventions (arrow-over-`function`, named-over-default exports) —
    only when the rewrite is local and every import site is in scope.
  - Clear complexity wins — an early return, a small well-named extraction —
    when it unambiguously reads better.
  - Honest-type fixes that replace an introduced `any` with the real type.
- **Advisory tier** — the judgment calls, never applied autonomously:
  - **Dead-code / unused-dependency deletion (Knip)** — deleting something a
    test or a dynamic import actually uses is the classic false positive.
  - **De-duplication / clone extraction (JSCPD)** — only worth it when the
    abstraction is honest.
  - **Design-pattern changes** — never refactored to a pattern autonomously.

The tiers map onto the seven dimensions above, not alongside them: safe-tier
items are drawn from spelling/naming, conventions, complexity, and TypeScript
idioms; advisory-tier items are drawn from dependencies, copy-paste, and
design patterns.

## Spelling & naming → `spellings.patch`

Roughly in order of objectivity:

- **Spelling** — typos in identifiers, comments, and strings. Use the project's
  spell tooling if it has any (e.g. `cspell`), otherwise read carefully.
- **Naming convention** — if ESLint's `@typescript-eslint/naming-convention` is
  enabled, **do not re-derive the rules yourself**: a clean lint already proves
  the casing/affix conventions hold, so trust it. Read the naming-convention
  findings from the ESLint section of the digest; only when that rule is absent
  should you reason about convention manually.
- **Intention-revealing naming** — the highest-value and most subjective: does a
  name tell the reader _why it exists_, _what it holds_, and _how it's used_?
  Flag `data`, `tmp`, `handle`, `flag`, `doStuff`, and the like when a more
  precise name exists. Don't rename for its own sake — only when the new name
  genuinely reduces the reader's effort.
- **Single-letter variables** — names like `i`, `j`, `k` carry no meaning on
  their own, so they only earn their keep as a loop index where the surrounding
  `for` makes the role obvious. Outside a loop — a function param, a
  destructured field, a standalone `const` — suggest an intention-revealing
  name; leave loop counters alone.
- **Prefer parameter destructuring** — when a function takes an object
  (especially a config/options bag), destructure in the signature
  (`function f({ id, name, retries })`) rather than threading `opts.id` through
  the body. The signature then doubles as documentation and call sites read as
  named arguments. Suggest this on repeated `arg.foo` access or a positional
  list long enough that callers can't tell which argument is which.

## Dependencies → `dependencies.patch`

Unused dependencies add weight to an already-crowded `package.json` and mislead
readers about what the code relies on. Read the **Knip section of the digest**
(fallback: `npx knip`). Report unused `dependencies`/`devDependencies` and
unused exports the scope is responsible for. If a dependency is used but
mis-placed (a runtime dep in `devDependencies` or vice-versa), note that too.
Knip is the most false-positive-prone tool here — verify before deleting, per
[tool-playbook.md](tool-playbook.md#knip). When the project lacks Knip, suggest
adopting it (or `@ladamczyk/qoq-knip` / the `qoq` CLI).

## Complexity / SOLID → `complexity.patch`

Code should stay easy to reason about. Measure cognitive complexity with
**`eslint-plugin-sonarjs`** at its `recommended` settings (the
`sonarjs/cognitive-complexity` rule is the anchor) — it's the base of every qoq
ESLint template. Read the `sonarjs/*` findings from the **ESLint section of the
digest**; if the plugin isn't present, run it ad hoc and suggest the project
adopt it. For each flagged function, propose the smallest restructuring that
lowers complexity — extract a well-named helper, replace a nested conditional
with an early return, collapse a flag into polymorphism — and only if it
genuinely reads better. A SOLID violation is worth flagging only when fixing it
reduces complexity, not when it just adds indirection.

## Copy-paste → `copy_paste.patch`

Duplicated logic drifts out of sync. Read the **JSCPD section of the digest**
(fallback: `npx jscpd`), which already reflects the project's configured
duplication threshold. The digest carries each clone's file/line ranges; read
the actual duplicated code **from the source files at those ranges** (the lean
report doesn't embed fragment text) so an extraction is faithful to both
copies. When the scope clones existing logic, propose extracting the shared
piece into one well-named unit and pointing both call sites at it — _but only
if the abstraction is honest_. Two blocks that look alike today but answer to
different reasons to change should stay separate; say so rather than forcing a
premature shared helper.

## Code conventions → `conventions.patch`

These aren't language idioms — they're house style: choosing one canonical
_form_ where the language offers two equivalent ones. They apply to both
JavaScript and TypeScript. There's no `qoq` tool behind them by default, so
it's a careful read — but if the project's ESLint already enforces one (e.g.
`prefer-arrow-callback`, `eslint-plugin-prefer-arrow`, or
`import/no-default-export`), trust a clean lint and reason manually only where
no rule covers the case.

- **Prefer arrow functions over the `function` keyword — except where a dynamic
  `this` is genuinely needed.** An arrow function has no `this`, `arguments`,
  or `prototype` of its own, which is exactly what you want for the common
  case: a callback, a small transformation, a handler passed around as a value.
  Suggest converting a `function` expression to an arrow when none of those
  own-binding features are used. Keep `function` where the code _relies_ on a
  dynamically-bound `this` (an object/prototype method invoked as
  `obj.method()`, a function deliberately `call`/`apply`/`bind`-ed, an event
  handler that reads `this`), and where you need a generator (`function*`),
  `arguments`, or declaration hoisting. Those aren't violations — don't flag
  them, and when in doubt whether `this` is dynamic, leave it alone.
- **Prefer named exports over a default export — except a React component that
  must be lazy-loaded.** A named export pins one canonical identifier to the
  symbol, so every import site spells it the same way: greppable, rename-safe,
  auto-importable. A default export lets each importer invent its own local
  name. So flag an `export default` and propose a named export, updating its
  import sites in the same patch. The one honest exception is a component
  loaded through `React.lazy(() => import('./X'))`, which _requires_ the module
  to expose the component as its default — leave that in place and say why.

## Design patterns → `patterns.patch`

Look for code smells that a standard, well-understood pattern would resolve
more cleanly. **Read [design-patterns.md](design-patterns.md)** for the catalog
— a bundled, offline reference (a smell→pattern index plus JS/TS-idiomatic
notes, distilled from GoF and Refactoring Guru) so you don't refetch the web
each run. Reach for the web only for a pattern the reference doesn't cover.

When you propose a pattern, name it, explain _why_ this situation calls for it,
and **confirm it doesn't add more complexity than it removes** — a pattern
applied for its own sake is itself a smell. The bar: a maintainer would find
the patterned version easier to extend, not just more "correct".

## TypeScript idioms → `typescript.patch`

TypeScript-only — skip this dimension entirely for plain-JavaScript code.
There's no `qoq` tool behind it; it's a careful read of the scope's
`.ts`/`.tsx` files. Three conventions, the first two gated on how modern the
project's compile target is, so **read `compilerOptions` from the project's
`tsconfig.json` first** (resolve `extends` if a setting isn't defined locally)
and anchor suggestions to it.

- **Match the syntax to the project's target** — when `module` is `esnext` or
  `nodenext`, lean into current syntax: top-level `await`, `using` for
  disposables, native ESM `import`, `satisfies`. On an older `module`/`target`,
  hold back — a rewrite the build can't compile is a regression.
- **Prefer immutable (non-mutating) array/object methods** — `arr.toSorted()`,
  `.toReversed()`, `.toSpliced()`, `.with(i, x)` over the in-place `.sort()`,
  `.reverse()`, `.splice()` when the original shouldn't be mutated. These
  landed in ES2023, so only suggest them when the project's `target`/`lib`
  includes them — otherwise note the intent (e.g. `[...arr].sort()`) without
  reaching for syntax the runtime won't have.
- **Demand honest types — no `any`** — `any` switches off the type checker and
  quietly spreads through surrounding code. Flag every `any` the scope
  introduces and propose the real type, a generic, or a narrowed union.
  `unknown` is the escape hatch when a value genuinely can't be typed ahead of
  time — but it forces a narrowing check before use, so it's safe. Reach for it
  only once you've confirmed there's no precise type available, and say _why_
  nothing tighter fits.

## Quick reference

| Dimension          | Via engine digest (preferred)                     | qoq default               | Generic fallback                          | Patch file           |
| ------------------ | ------------------------------------------------- | ------------------------- | ----------------------------------------- | -------------------- |
| Spelling & naming  | digest ESLint section (naming rule) + read        | ESLint naming rule + read | `cspell` / careful read                   | `spellings.patch`    |
| Dependencies       | digest Knip section                               | Knip                      | `npx knip`                                | `dependencies.patch` |
| Complexity / SOLID | digest ESLint section (`sonarjs/*`)               | `eslint-plugin-sonarjs`   | `npx eslint` / `complexity` rule          | `complexity.patch`   |
| Copy-paste         | digest JSCPD section + read source at line ranges | JSCPD                     | `npx jscpd`                               | `copy_paste.patch`   |
| Code conventions   | careful read (JS + TS)                            | same                      | `prefer-arrow` / `no-default-export` lint | `conventions.patch`  |
| Design patterns    | bundled [design-patterns.md](design-patterns.md)  | same                      | same                                      | `patterns.patch`     |
| TypeScript idioms  | `tsconfig.json` + careful read (TS only)          | same                      | same                                      | `typescript.patch`   |
| Formatting         | `qoq --fix` / `qoq:fix`                           | Prettier                  | `npx prettier`                            | (readability pass)   |
