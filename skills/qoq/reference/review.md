# review

A code review is only useful if it changes the code that ships. This command
turns a review into a set of **small, reviewable, revertible** improvements rather
than a wall of prose the author has to re-implement by hand. The guiding value is
QoQ — _quality over quantity_: prefer a few high-confidence, intention-revealing
changes over a long list of nitpicks.

It is also the **canonical analysis engine** for the skill: the seven dimensions,
the patch recipe, and the execution mechanics defined here are reused verbatim by
the `refactor` command, which only changes where the work comes from and how it is
fanned out. Edits to the standards here propagate to `refactor` automatically.

The flow separates **planning** from **executing**:

- **Plan** — diff the branch, get findings, and write each category of suggestion
  as its own git patch file. Nothing in the working tree changes yet, so the user
  can read, edit, or reject any patch before it lands.
- **Execute** — apply the approved patches one category at a time, running the
  project's real lint/test/build (the _validation step_) so any breakage is
  attributable to a single patch and trivially reverted.

**Tooling.** Four of the dimensions below are backed by a tool (naming &
complexity by ESLint, dead code & dependencies by Knip, duplication by JSCPD,
formatting by Prettier). For those, don't detect a CLI, invent flags, or parse raw
reports — defer to the shared **engine** ([engine.md](engine.md)), already located
during Setup. It owns discovery (how `qoq` runs here) and execution (the
`qoq --check --json` run collapsed into a compact digest via
`scripts/summarize.mjs`). You read that digest, grouped by tool and rule, never the
raw JSON. What stays in this command is everything the engine doesn't do: scoping
to the branch diff, the dimensions with no tool behind them (code conventions,
design patterns, TypeScript idioms, and spelling beyond identifiers), the patch
conventions, and the validation gate. When the project has no `qoq`, the engine's
fallback applies — use the project's own ESLint/Knip/JSCPD/Prettier scripts.

---

## Phase 1 — Discovery

Setup already confirmed a clean tree and located the engine. The rest of discovery
is review-specific.

1. **Ask for the base branch.** This is the reference the diff is computed against
   (often `main`, `master`, or `develop`). Don't assume — ask, unless the user
   already named it.

2. **Scope the diff.** Compute the real change set against the merge-base so you
   review what the branch introduced, not unrelated commits on the base:

   ```bash
   git merge-base <base> HEAD
   git diff --stat $(git merge-base <base> HEAD)..HEAD
   git diff $(git merge-base <base> HEAD)..HEAD -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs'
   ```

   Read the diff. Note which files are new, which are modified, and which areas are
   the substance of the change. The review only covers these changed lines and the
   files they touch — not the whole repo.

3. **Ask about subagents.** Tell the user the seven analyses in Phase 2 are
   independent and can run in parallel via subagents to save wall-clock time. Ask
   whether that's allowed. If yes, fan them out — **one `qoq-analyzer` worker per
   dimension** (see [The `qoq-analyzer` worker](#the-qoq-analyzer-worker)), each
   writing its own patch file into `.qoq/`, each in an isolated worktree
   or scoped to disjoint files. If no, run them in sequence yourself.

4. **Discover the validation commands.** You need three things: how to
   **lint/format**, how to **test**, and how to **build**. Read `package.json`
   `scripts` and any project docs (`README`, `CLAUDE.md`, `AGENTS.md`); prefer
   scripts the project already defines. In QoQ mode the lint/format gate is `qoq`
   itself — prefer the project's `qoq:check` script (or `qoq --check`) and `qoq:fix`
   (or `qoq --fix`), since one command covers Prettier, ESLint, Knip, and JSCPD
   together. **Run each one now, before changing anything**, and confirm it passes.
   This establishes a green baseline and locks in the exact commands you'll re-run
   after each patch — the _validation step_. If a command already fails on a clean
   checkout, surface that and ask how to proceed; you can't use a red baseline to
   validate refactors.

Create a workspace for the patch files so they don't clutter the repo:

```bash
mkdir -p .qoq
```

Then keep that workspace out of the way of `git status` and the formatter for the
duration of the review. As it fills with `.patch` files and JSON reports, an
un-ignored workspace causes two problems: untracked noise in every `git status`,
and — because Prettier 3 honors `.gitignore` when it walks the tree — the formatter
treats those generated files as source and flags them as "unformatted", turning the
gate red for unrelated reasons. Append a clearly-labeled block to `.gitignore` (use
the Edit tool; create `.gitignore` if absent):

```gitignore
# QoQ workspace — temporary, removed when the run finishes
.qoq/
```

This is a deliberate, self-reverting change you'll undo in Phase 5. Note whether you
**created** `.gitignore` (you'll delete it) or **appended** to an existing one
(you'll strip just this block); the label keeps the revert unambiguous even if the
review is interrupted partway.

---

## Phase 2 — Analysis

Run the seven analyses below (the TypeScript-idioms one applies only to TS projects
— skip it for plain JavaScript). Each produces **one git patch file** in
`.qoq/` containing the _minimum_ change needed, written to the project's
own code standards. A patch should be `git apply`-able; generate them in
unified-diff form. If a dimension yields nothing worth changing, say so and skip its
patch — quality over quantity means an empty result is a fine result.

Only review the changed code from Phase 1. The point is to evaluate _this branch's_
contribution, not to relitigate the whole codebase.

### Tool-backed findings via the engine

Four of the seven dimensions are backed by a tool. Get their findings from the
engine rather than running ESLint/Knip/JSCPD yourself. Following
[engine.md](engine.md), prime the reports once and read its digest:

```bash
npx qoq --check --json --output .qoq/reports
node <skill>/scripts/summarize.mjs .qoq/reports
```

(`<skill>` is this skill's directory; the summarizer is bundled there. A non-zero
`qoq` exit just means findings exist — the reports are still written.) The digest
lists every finding grouped by tool and rule, with file locations — enough to plan a
patch without ever loading the raw JSON. Drop to a specific `*-report.json` only for
a detail the digest doesn't carry (a duplicated fragment's text, a precise export
position), guided by [report-schemas.md](report-schemas.md).

`qoq` runs across the project's configured `srcPath`, not just the branch diff — so
**filter the digest's findings down to the files and lines Phase 1 identified**
before turning anything into a patch. Knip is whole-project by nature; report only
the unused deps/exports _this branch_ introduced.

Mapping from the four tool-backed dimensions to the digest:

| Dimension          | Digest section                          |
| ------------------ | --------------------------------------- |
| Spelling & naming  | ESLint (naming-convention rule)         |
| Dependencies       | Knip                                    |
| Complexity / SOLID | ESLint (`sonarjs/cognitive-complexity`) |
| Copy-paste         | JSCPD                                   |

The remaining dimensions — spelling beyond identifiers, code conventions, TypeScript
idioms, and design patterns — have no tool behind them; handle those by reading the
diff. When the project has no `qoq`, ignore this section and use each dimension's
documented fallback tool directly.

### Producing a patch

The deliverable of each analysis is a real, `git apply`-able patch — _not_ prose
describing a change. The reliable recipe, which leaves the working tree clean
afterward, is **edit → diff → restore → check**:

```bash
# 1. Edit the file(s) in place with your suggested change (use the Edit tool).
# 2. Capture the change as a patch:
git diff -- <changed paths> > .qoq/<name>.patch
# 3. Restore the tree so the next analysis starts clean:
git restore -- <changed paths>
# 4. Verify the patch is valid and applies cleanly:
git apply --check .qoq/<name>.patch
```

Step 3 is what keeps the "nothing changes yet" promise true: the edits live only in
the patch file until Phase 4. If `git apply --check` fails, the patch is malformed —
regenerate it rather than shipping it.

**Running in parallel (subagents):** never let two subagents edit the same working
tree at once — their edits and `git restore`s will trample each other. Give each
subagent its own isolated worktree, or assign each a disjoint set of files. If
neither is possible, run the analyses sequentially. Dispatch each parallel analysis
to the **`qoq-analyzer` worker**, the shared home of this recipe — see below.

### The `qoq-analyzer` worker

The parallel analyses above are all the same job — _given a scope and a set of
checks, stage one reviewable patch per finding_ — so that job lives in one place:
the **`qoq-analyzer`** agent, bundled at [../agents/qoq-analyzer.md](../agents/qoq-analyzer.md).
It encapsulates the patch recipe, the config-respecting rules, and the
quality-over-quantity bar, so each command that fans out dispatches to it instead of
re-describing the worker contract. The `refactor` command dispatches to the same
worker.

When you fan out, dispatch one `qoq-analyzer` per dimension via the Task tool
(`subagent_type: qoq-analyzer` when it's registered; otherwise spawn a
`general-purpose` subagent and have it read `agents/qoq-analyzer.md` as its
instructions). Pass each worker:

- **scope** — the disjoint files it owns from the Phase 1 diff;
- **checks** — its one dimension;
- **digest_path** — the digest from the `qoq --check --json` run above (for the
  tool-backed dimensions);
- **tooling** — `engine` when QoQ mode is on, else `project-tools`/`npx`;
- **output_dir** — `.qoq/`;
- **references** — this file (the dimension definitions), [tool-playbook.md](tool-playbook.md),
  and [design-patterns.md](design-patterns.md) for the patterns dimension.

Each worker returns a one-line-per-check summary and its patch paths. You collect
those for Phase 3 — the worker never applies anything or runs the gate; that stays
here.

### Spelling & naming → `spellings.patch`

Roughly in order of objectivity:

- **Spelling** — typos in identifiers, comments, and strings. Use the project's
  spell tooling if it has any (e.g. `cspell`), otherwise read carefully.
- **Naming convention** — if ESLint's `@typescript-eslint/naming-convention` is
  enabled, **do not re-derive the rules yourself**: a clean lint already proves the
  casing/affix conventions hold, so trust it. When the engine ran, read the
  naming-convention findings from the **ESLint section of its digest**; otherwise run
  the project's ESLint. Only when that rule is absent should you reason about
  convention manually.
- **Intention-revealing naming** — the highest-value and most subjective: does a
  name tell the reader _why it exists_, _what it holds_, and _how it's used_? Flag
  `data`, `tmp`, `handle`, `flag`, `doStuff`, and the like when a more precise name
  exists. Don't rename for its own sake — only when the new name genuinely reduces
  the reader's effort.
- **Single-letter variables** — names like `i`, `j`, `k` carry no meaning on their
  own, so they only earn their keep as a loop index where the surrounding `for` makes
  the role obvious. Outside a loop — a function param, a destructured field, a
  standalone `const` — flag them and suggest an intention-revealing name; leave loop
  counters alone.
- **Prefer parameter destructuring** — when a function takes an object (especially a
  config/options bag), destructure the params in the signature
  (`function f({ id, name, retries })`) rather than threading `opts.id` through the
  body. The signature then doubles as documentation, and call sites read as named
  arguments. Suggest this on repeated `arg.foo` access or a positional parameter list
  long enough that callers can't tell which argument is which.

### Dependencies → `dependencies.patch`

Unused dependencies add weight to an already-crowded `package.json` and mislead
readers about what the code relies on. Detect them with the project's tool: when the
engine ran, read the **Knip section of its digest**; otherwise **Knip** is the qoq
default and `npx knip` works if it isn't wired up. Report unused
`dependencies`/`devDependencies` and unused exports the change introduced. If a
dependency is used but mis-placed (a runtime dep in `devDependencies` or vice-versa),
note that too. When the project lacks Knip, suggest adopting it (or
`@ladamczyk/qoq-knip` / the `qoq` CLI).

### Complexity / SOLID → `complexity.patch`

Code should stay easy to reason about. Measure cognitive complexity with
**`eslint-plugin-sonarjs`** at its `recommended` settings (the
`sonarjs/cognitive-complexity` rule is the anchor) — it's the base of every qoq
ESLint template. When the engine ran, read the `sonarjs/*` findings from the
**ESLint section of its digest**. If the plugin isn't present, run it ad hoc and
suggest the project adopt it. For each flagged function, propose the smallest
restructuring that lowers complexity — extract a well-named helper, replace a nested
conditional with an early return, collapse a flag into polymorphism — and only if it
genuinely reads better. A SOLID violation is worth flagging only when fixing it
reduces complexity, not when it just adds indirection.

### Copy-paste → `copy_paste.patch`

Duplicated logic drifts out of sync. Detect near-duplicates with **JSCPD**: when the
engine ran, read the **JSCPD section of its digest**, which already reflects the
project's configured duplication threshold; otherwise `npx jscpd` works. When the
change clones existing logic, propose extracting the shared piece into one
well-named unit and pointing both call sites at it — _but only if the abstraction is
honest_. Two blocks that look alike today but answer to different reasons to change
should stay separate; say so rather than forcing a premature shared helper.

### Code conventions → `conventions.patch`

These aren't language idioms — they're house style: choosing one canonical _form_
where the language offers two equivalent ones. They apply to both JavaScript and
TypeScript. There's no `qoq` tool behind them by default, so it's a careful read —
but if the project's ESLint already enforces one (e.g. `prefer-arrow-callback`,
`eslint-plugin-prefer-arrow`, or `import/no-default-export`), trust a clean lint and
reason manually only where no rule covers the case.

- **Prefer arrow functions over the `function` keyword — except where a dynamic
  `this` is genuinely needed.** An arrow function has no `this`, `arguments`, or
  `prototype` of its own, which is exactly what you want for the common case: a
  callback, a small transformation, a handler passed around as a value. Suggest
  converting a `function` expression to an arrow when none of those own-binding
  features are used. Keep `function` where the code _relies_ on a dynamically-bound
  `this` (an object/prototype method invoked as `obj.method()`, a function
  deliberately `call`/`apply`/`bind`-ed, an event handler that reads `this`), and
  where you need a generator (`function*`), `arguments`, or declaration hoisting.
  Those aren't violations — don't flag them, and when in doubt whether `this` is
  dynamic, leave it alone.
- **Prefer named exports over a default export — except a React component that must
  be lazy-loaded.** A named export pins one canonical identifier to the symbol, so
  every import site spells it the same way: greppable, rename-safe, auto-importable. A
  default export lets each importer invent its own local name. So flag an
  `export default` and propose a named export, updating its import sites in the same
  patch. The one honest exception is a component loaded through
  `React.lazy(() => import('./X'))`, which _requires_ the module to expose the
  component as its default — leave that in place and say why.

### Design patterns → `patterns.patch`

Look for code smells that a standard, well-understood pattern would resolve more
cleanly. **Read [design-patterns.md](design-patterns.md)** for the catalog — it's a
bundled, offline reference (a smell→pattern index plus JS/TS-idiomatic notes,
distilled from GoF and Refactoring Guru) so you don't refetch the web each run. Reach
for the web only if the change involves a pattern the reference doesn't cover.

When you propose a pattern, name it, explain _why_ this situation calls for it, and
**confirm it doesn't add more complexity than it removes** — a pattern applied for
its own sake is itself a smell. The bar is: a maintainer would find the patterned
version easier to extend, not just more "correct".

### TypeScript idioms → `typescript.patch`

TypeScript-only — skip this dimension entirely for a plain-JavaScript change. There's
no `qoq` tool behind it; it's a careful read of the changed `.ts`/`.tsx` files. Three
conventions, the first two gated on how modern the project's compile target is, so
**read `compilerOptions` from the project's `tsconfig.json` first** (resolve
`extends` if a setting isn't defined locally) and anchor your suggestions to it.

- **Match the syntax to the project's target** — when `module` is `esnext` or
  `nodenext`, lean into current syntax — top-level `await`, `using` for disposables,
  native ESM `import`, `satisfies`. On an older `module`/`target`, hold back: a
  rewrite the build can't compile is a regression.
- **Prefer immutable (non-mutating) array/object methods** — `arr.toSorted()`,
  `.toReversed()`, `.toSpliced()`, `.with(i, x)` over the in-place `.sort()`,
  `.reverse()`, `.splice()` when the original shouldn't be mutated. These landed in
  ES2023, so only suggest them when the project's `target`/`lib` includes them —
  otherwise note the intent (e.g. `[...arr].sort()`) without reaching for syntax the
  runtime won't have.
- **Demand honest types — no `any`** — `any` switches off the type checker and
  quietly spreads through surrounding code. Flag every `any` the change introduces and
  propose the real type, a generic, or a narrowed union. `unknown` is the escape hatch
  when a value genuinely can't be typed ahead of time — but it forces a narrowing check
  before use, so it's safe. Reach for it only once you've confirmed there's no precise
  type available, and say _why_ nothing tighter fits.

---

## Phase 3 — Present the plan & get approval

Summarize what each analysis found and what its patch would change — grouped by the
seven dimensions, each with a one-line rationale and a sense of size (lines/files
touched). Keep it scannable; this is the user's chance to steer.

Then ask whether they want to **edit the plan** (drop or adjust specific patches) or
whether you may **execute it**. Wait for an answer. Don't apply anything yet.

---

## Phase 4 — Execution

Apply the approved patches **in sequence**, no subagents — order matters because
later patches must apply cleanly on top of earlier ones. Apply lowest-risk first:

1. `spellings.patch`
2. `dependencies.patch`
3. `complexity.patch`
4. `copy_paste.patch`
5. `conventions.patch`
6. `patterns.patch`
7. `typescript.patch`

For each approved patch, in this order:

```bash
git apply --check .qoq/<name>.patch   # confirm it still applies
git apply .qoq/<name>.patch
# then run the validation step (lint/test/build from Phase 1)
```

After each apply, run the validation step before moving on, so any breakage points
at exactly one patch.

**When a patch no longer applies:** an earlier patch can move the lines a later one
targeted, so `git apply --check` fails. Don't force it — regenerate that patch
against the current tree using the [Producing a patch](#producing-a-patch) recipe,
then apply the fresh one. Only regenerate the patch that actually failed.

If validation goes red after a patch, stop, report which patch broke what, and ask
how to proceed rather than pushing through. `git restore` (or reverting the apply)
gets you back to the last green state.

---

## Phase 5 — Readability

Highly readable code follows one consistent format so reviewers spend attention on
logic, not whitespace. Once all approved patches are in and green, format the changed
files with the project's formatter. When the engine is in play, the formatter is
Prettier behind `qoq --fix` (or the `qoq:fix` script) — use the same `qoq` invocation
discovered in Setup; it runs Prettier (and the other auto-fixers) with the project's
exact config in one pass. Otherwise **Prettier** is the qoq default
(`npm run format`, or `npx prettier --write` on the changed paths). Run the validation
step one final time so the formatted result is confirmed green, then summarize what
landed.

Finally, clean up so the working tree ends with only the applied, formatted
improvements. Do these two in order:

1. **Remove the workspace.** `rm -rf .qoq` to keep the intermediate patch
   files and reports out of the commit.
2. **Revert the `.gitignore` change from Phase 1.** Strip the temporary block you
   added — or delete `.gitignore` entirely if you created it solely for this. When
   `.gitignore` was already tracked and started clean, `git restore .gitignore` is the
   quickest exact revert.

Removing the workspace _before_ reverting the ignore rule means the directory is gone
by the time it stops being ignored, so it never flashes back into `git status`. The
result is a clean tree containing exactly the improvements, ready to commit.

---

## Quick reference

| Dimension          | Via engine digest (preferred)                     | qoq default               | Generic fallback                          | Patch file           |
| ------------------ | ------------------------------------------------- | ------------------------- | ----------------------------------------- | -------------------- |
| Spelling & naming  | digest ESLint section (naming rule) + read        | ESLint naming rule + read | `cspell` / careful read                   | `spellings.patch`    |
| TypeScript idioms  | `tsconfig.json` + careful read (TS projects only) | same                      | same                                      | `typescript.patch`   |
| Dependencies       | digest Knip section                               | Knip                      | `npx knip`                                | `dependencies.patch` |
| Complexity / SOLID | digest ESLint section (`sonarjs/*`)               | `eslint-plugin-sonarjs`   | `npx eslint` / `complexity` rule          | `complexity.patch`   |
| Copy-paste         | digest JSCPD section                              | JSCPD                     | `npx jscpd`                               | `copy_paste.patch`   |
| Code conventions   | careful read (JS + TS)                            | same                      | `prefer-arrow` / `no-default-export` lint | `conventions.patch`  |
| Design patterns    | bundled [design-patterns.md](design-patterns.md)  | same                      | same                                      | `patterns.patch`     |
| Formatting         | `qoq --fix` / `qoq:fix`                           | Prettier                  | `npx prettier`                            | (Phase 5)            |

**QoQ mode** = the project has `@ladamczyk/qoq-cli` installed _and_ a `qoq.config.js`
at its root, so the engine can run. When on, it primes all reports once with
`qoq --check --json --output .qoq/reports` and you read the
`summarize.mjs` digest — never the raw JSON — for the four tool-backed dimensions.

**Validation step** = the project's own lint + test + build commands (in QoQ mode,
`qoq --check` / `qoq:check` is the lint gate), verified green in Phase 1 and re-run
after every applied patch.
