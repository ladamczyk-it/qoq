---
name: qoq-code-review
description: >-
  Review the JavaScript/TypeScript changes on a branch against a base branch,
  in the QoQ "quality over quantity" spirit — spelling & intention-revealing
  naming, unused dependencies, cognitive complexity / SOLID, copy-paste
  duplication, code conventions (arrow functions over the `function` keyword,
  named exports over default), modern TypeScript idioms (immutable methods,
  no `any`, target-appropriate syntax), and design-pattern code smells. Use
  this skill
  whenever the user
  asks to "review my changes/branch/diff/PR", wants a code review before
  merging, asks to check code quality, naming, dead dependencies, duplication,
  or complexity, or says something like "is this ready to merge" / "clean up
  this branch" — even if they don't say the words "code review". Built around a
  plan-then-execute flow: every suggestion is staged as a reviewable git patch,
  the project's own lint/test/build is the validation gate, and patches are
  applied one at a time so a bad change is easy to isolate and revert. This is
  the local, hands-on reviewer; it is distinct from the cloud multi-agent
  `code-review` skill.
allowed-tools:
  - Bash(npm run:*)
  - Bash(qoq:*)
  - Bash(npx qoq:*)
  - Bash(mkdir -p .qoq-code-review)
  - Bash(git diff:*)
  - Bash(git merge-base:*)
  - Bash(git apply:*)
  - Bash(git restore:*)
  - Bash(git status:*)
  - Bash(git log:*)
metadata:
  version: 1.0.0
---

# qoq-code-review

A code review is only useful if it changes the code that ships. This skill exists to turn a review into a set of **small, reviewable, revertible** improvements rather than a wall of prose the author has to re-implement by hand. The guiding value is QoQ — _quality over quantity_: prefer a few high-confidence, intention-revealing changes over a long list of nitpicks.

The design separates **planning** from **executing**, for the same reasons a careful refactor does:

- **Plan** — diff the branch, run the analysis tools, and write each category of suggestion as its own git patch file. Nothing in the working tree changes yet, so the user can read, edit, or reject any patch before it lands.
- **Execute** — apply the approved patches one category at a time, running the project's real lint/test/build (the _validation step_) so any breakage is attributable to a single patch and trivially reverted.

Two failure modes drive this shape. First, **review that never lands** — feedback the author silently drops because re-typing it is tedious; the antidote is shipping ready-to-apply patches. Second, **unattributable breakage** — applying many edits at once so you can't tell which one broke the build; the antidote is one-category-at-a-time application with validation in between.

A note on autonomy: this mutates a real repo. Stop and ask at the marked decision points rather than pushing through. If the user has already stated preferences (base branch, whether subagents are allowed, which patches to apply), honor them and don't re-ask.

A note on tooling — three tiers, in order of preference:

1. **The `qoq` CLI (preferred, when available _and_ configured).** If the target project is wired up with QoQ — `@ladamczyk/qoq-cli` is installed and a `qoq.config.js` sits at the project root — then `qoq` already knows how to run Prettier, ESLint (with `eslint-plugin-sonarjs` and the naming-convention rule), Knip, and JSCPD with the project's _exact_ configured settings. In that case **drive every analysis through `qoq` rather than invoking the underlying tools yourself.** You measure against the same rules the project enforces in CI instead of a config you re-derived, and you don't have to discover each tool's flags. See [Tooling: prefer `qoq`](#tooling-prefer-qoq) for how.
2. **The project's own tools (fallback).** If `qoq` isn't wired up but the project commits to Prettier/ESLint/Knip/JSCPD directly, use those via the project's own scripts.
3. **Ad-hoc `npx` (last resort).** When a relevant tool is missing entirely, you can still run it with `npx`, but say so, and suggest the project adopt it (or pull in the matching `@ladamczyk/qoq-*` config / the `qoq` CLI) rather than silently depending on a tool the repo hasn't committed to.

This skill works on **any** JS/TS project — detect which tier applies and prefer the highest one available.

A note on its sibling: **`qoq-code-refactor`** runs the exact same seven analyses, tooling tiers, and patch conventions, but over a **user-chosen scope** (a path, a package, or the whole project) instead of a branch diff — and it can fan the work out across subagents by code area. Reach for that one when there's no branch to review and the user wants to improve an existing area or the whole codebase on demand; reach for _this_ one when the task is vetting what a branch changed against its base.

---

## Phase 1 — Discovery

Before anything changes, make sure you can tell "working" from "broken" and that you can get back to a clean state.

1. **Confirm a clean working tree.** Run `git status`. This skill reviews the branch's **committed** changes and uses `git` as its safety net — it generates patches by editing files and reverting (see [Producing a patch](#producing-a-patch)), so a dirty tree would get tangled up in that and you'd lose the ability to cleanly revert. If there are uncommitted changes, point them out and ask the user to commit or stash them, or to confirm stashing is fine, before continuing.

2. **Ask for the base branch.** This is the reference the diff is computed against (often `main`, `master`, or `develop`). Don't assume — ask, unless the user already named it.

3. **Scope the diff.** Compute the real change set against the merge-base so you review what the branch introduced, not unrelated commits on the base:

   ```bash
   git merge-base <base> HEAD
   git diff --stat $(git merge-base <base> HEAD)..HEAD
   git diff $(git merge-base <base> HEAD)..HEAD -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs'
   ```

   Read the diff. Note which files are new, which are modified, and which areas are the substance of the change. The review only covers these changed lines and the files they touch — not the whole repo.

4. **Ask about subagents.** Tell the user the seven analyses in Phase 2 are independent and can run in parallel via subagents to save wall-clock time. Ask whether that's allowed. If yes, fan them out — one subagent per dimension, each writing its own patch file into `.qoq-code-review/`, each in an isolated worktree or scoped to disjoint files (see [Producing a patch](#producing-a-patch) for why this matters). If no, run them in sequence yourself.

5. **Detect the QoQ CLI.** Check whether the project is on the preferred tier: is `@ladamczyk/qoq-cli` in `package.json` dependencies, and does a `qoq.config.js` exist at the project root? (A `qoq:check` / `qoq:fix` script or a resolvable `qoq` binary is corroborating evidence.) Both the install **and** the config must be present — `qoq.config.js` is what tells `qoq` which tools and rules to run, so an installed-but-unconfigured CLI is _not_ the preferred tier. Record the result: it decides whether Phase 2 drives the analyses through `qoq` (see [Tooling: prefer `qoq`](#tooling-prefer-qoq)) or through the project's own tools.

6. **Discover the validation commands.** You need three things: how to **lint/format**, how to **test**, and how to **build**. Read `package.json` `scripts` and any project docs (`README`, `CLAUDE.md`, `AGENTS.md`). Prefer scripts the project already defines over commands you invent. **When QoQ is the active tier (step 5), the lint/format gate is `qoq` itself** — prefer the project's `qoq:check` script (or `qoq --check`) for validation and `qoq:fix` (or `qoq --fix`) for auto-fixing, since one command covers Prettier, ESLint, Knip, and JSCPD together. If anything is ambiguous, ask the user rather than guessing. **Run each one now, before changing anything**, and confirm it passes. This serves two purposes: it establishes a green baseline, and it locks in the exact commands you'll re-run after each patch — the _validation step_. If a command already fails on a clean checkout, surface that and ask how to proceed; you can't use a red baseline to validate refactors.

Create a workspace for the patch files so they don't clutter the repo:

```bash
mkdir -p .qoq-code-review
```

Then keep that workspace out of the way of `git status` and the formatter for the duration of the review. As it fills with `.patch` files and JSON reports, an un-ignored workspace causes two distinct problems: it shows up as untracked noise in every `git status` you run, and — because Prettier 3 honors `.gitignore` by default when it walks the tree — the formatter (the Phase 4 validation step and the Phase 5 pass) treats those generated files as source and flags them as "unformatted", turning the gate red for reasons that have nothing to do with the branch. Exclude it from both. Append a clearly-labeled block to `.gitignore` (use the Edit tool; create `.gitignore` if the project doesn't have one):

```gitignore
# qoq-code-review workspace — temporary, removed when the review finishes
.qoq-code-review/
```

This is a deliberate, self-reverting change you'll undo in Phase 5 — not a breach of the clean-tree principle, since you control it precisely. Note whether you had to **create** `.gitignore` (you'll delete it at the end) or **appended** to an existing one (you'll strip just this block); the label keeps the revert unambiguous even if the review is interrupted partway.

---

## Phase 2 — Analysis

Run the seven analyses below (the TypeScript-idioms one applies only to TS projects — skip it for plain JavaScript). Each produces **one git patch file** in `.qoq-code-review/` containing the _minimum_ change needed, written to the project's own code standards. A patch should be `git apply`-able; generate them in unified-diff form (e.g. capture your edit as `git diff`, or hand-write a clean diff). If a dimension yields nothing worth changing, say so and skip its patch — quality over quantity means an empty result is a fine result.

Only review the changed code from Phase 1. The point is to evaluate _this branch's_ contribution, not to relitigate the whole codebase.

### Tooling: prefer `qoq`

If Phase 1 found QoQ on the preferred tier (CLI installed _and_ `qoq.config.js` present), run the tools **through `qoq`** instead of invoking ESLint/Knip/JSCPD directly. Two equivalent shapes:

- **One combined run (recommended).** Emit every tool's findings as structured reports in a single pass, then let each analysis read its own report:

  ```bash
  qoq --json --output .qoq-code-review/reports
  ```

  This writes `eslint-report.json`, `knip-report.json`, `jscpd-report.json`, and `prettier-report.json` into `.qoq-code-review/reports/`. It runs once, uses the project's exact rules, and means the report-backed analyses don't each re-run a linter — they parse JSON. (A non-zero exit just means findings exist; the reports are still written.)

- **Per-tool runs.** When you only want one dimension, filter to the relevant token: `qoq eslint`, `qoq knip`, `qoq jscpd`, `qoq prettier`. Add `--json --output .qoq-code-review/reports` for machine-readable output.

`qoq` runs across the project's configured `srcPath`, not just the branch diff — so after reading a report, **filter its findings down to the files and lines Phase 1 identified** before turning anything into a patch. Knip is whole-project by nature regardless; report only the unused deps/exports _this branch_ introduced.

Mapping from the seven dimensions to `qoq`:

| Dimension          | `qoq` source                                          |
| ------------------ | ----------------------------------------------------- |
| Spelling & naming  | `eslint-report.json` (naming-convention rule)         |
| Dependencies       | `knip-report.json`                                    |
| Complexity / SOLID | `eslint-report.json` (`sonarjs/cognitive-complexity`) |
| Copy-paste         | `jscpd-report.json`                                   |

Spelling beyond identifiers, the code-conventions dimension, the TypeScript-idioms dimension, and the design-patterns dimension have no `qoq` tool behind them — handle those by reading as before. When QoQ is _not_ the active tier, ignore this section and use each dimension's documented fallback.

### Producing a patch

The deliverable of each analysis is a real, `git apply`-able patch — _not_ prose describing a change. The reliable recipe, which leaves the working tree clean afterward, is **edit → diff → restore → check**:

```bash
# 1. Edit the file(s) in place with your suggested change (use the Edit tool).
# 2. Capture the change as a patch:
git diff -- <changed paths> > .qoq-code-review/<name>.patch
# 3. Restore the tree so the next analysis starts clean and nothing lands prematurely:
git restore -- <changed paths>
# 4. Verify the patch is valid and applies cleanly:
git apply --check .qoq-code-review/<name>.patch
```

Step 3 is what keeps the "nothing changes yet" promise true: the edits live only in the patch file until Phase 4. If `git apply --check` fails, the patch is malformed — regenerate it rather than shipping it.

**Running in parallel (subagents):** never let two subagents edit the same working tree at once — their edits and `git restore`s will trample each other. Give each subagent its own isolated worktree, or assign each a disjoint set of files. If neither is possible, run the analyses sequentially instead.

### Spelling & naming → `spellings.patch`

Roughly in order of objectivity:

- **Spelling** — typos in identifiers, comments, and strings. Use the project's spell tooling if it has any (e.g. `cspell`), otherwise read carefully.
- **Naming convention** — if ESLint's `@typescript-eslint/naming-convention` is enabled, **do not re-derive the rules yourself**: a clean lint already proves the casing/affix conventions hold, so trust it and move on. In QoQ mode read the naming-convention findings from `eslint-report.json` (from the combined `qoq --json` run, or `qoq eslint`); otherwise run the project's ESLint. Only when that rule is absent should you reason about convention manually.
- **Intention-revealing naming** — the highest-value and most subjective: does a name tell the reader _why it exists_, _what it holds_, and _how it's used_? Flag `data`, `tmp`, `handle`, `flag`, `doStuff`, and the like when a more precise name exists. Don't rename for its own sake — only when the new name genuinely reduces the reader's effort.
- **Single-letter variables** — names like `i`, `j`, `k` carry no meaning on their own, so they only earn their keep as a loop index where the surrounding `for` makes the role obvious. Outside a loop — a function param, a destructured field, a standalone `const` — a single letter forces the reader to hold "what is `x` again?" in their head. Flag those and suggest an intention-revealing name; leave loop counters alone.
- **Prefer parameter destructuring** — when a function takes an object (especially one with several fields, or a config/options bag), destructure the params in the signature (`function f({ id, name, retries })`) rather than threading `opts.id`, `opts.name` through the body. The signature then doubles as documentation of exactly what the function consumes, and the call sites read as named arguments instead of positional ones that are easy to transpose. Suggest this when you see repeated `arg.foo` access or a positional parameter list long enough that callers can't tell which argument is which.

### Dependencies → `dependencies.patch`

Unused dependencies add weight to an already-crowded `package.json` and mislead readers about what the code relies on. Detect them with the project's tool: in QoQ mode read `knip-report.json` (or run `qoq knip`); otherwise **Knip** is the qoq default and `npx knip` works if it isn't wired up. Report unused `dependencies`/`devDependencies` and unused exports the change introduced. If a dependency is used but mis-placed (a runtime dep in `devDependencies` or vice-versa), note that too. When the project lacks Knip, suggest adopting it (or `@ladamczyk/qoq-knip` / the `qoq` CLI).

### Complexity / SOLID → `complexity.patch`

Code should stay easy to reason about. Measure cognitive complexity with **`eslint-plugin-sonarjs`** at its `recommended` settings (the `sonarjs/cognitive-complexity` rule is the anchor) — it's the base of every qoq ESLint template. In QoQ mode it's already in the config, so read the `sonarjs/*` findings from `eslint-report.json` (or run `qoq eslint`). If the plugin isn't present, run it ad hoc (`npx eslint` with the plugin, or fall back to ESLint's built-in `complexity` rule) and suggest the project adopt it (or the `qoq` CLI). For each flagged function, propose the smallest restructuring that lowers complexity — extract a well-named helper, replace a nested conditional with an early return, collapse a flag into polymorphism — and only if it genuinely reads better. A SOLID violation is worth flagging only when fixing it reduces complexity, not when it just adds indirection.

### Copy-paste → `copy_paste.patch`

Duplicated logic drifts out of sync. Detect near-duplicates with **JSCPD**: in QoQ mode read `jscpd-report.json` (or run `qoq jscpd`), which already uses the project's configured duplication threshold; otherwise JSCPD is the qoq default and `npx jscpd` works. Look across the changed files and the rest of the repo. When the change clones existing logic, propose extracting the shared piece into one well-named unit and pointing both call sites at it — _but only if the abstraction is honest_. Two blocks that look alike today but answer to different reasons to change should stay separate; say so rather than forcing a premature shared helper.

### Code conventions → `conventions.patch`

These aren't language idioms — they're house style: choosing one canonical _form_ where the language offers two equivalent ones, so the codebase reads consistently and a reader never has to wonder which of two shapes a given file happened to use. They apply to both JavaScript and TypeScript. There's no `qoq` tool behind them by default, so it's a careful read — but if the project's ESLint already enforces one (e.g. `prefer-arrow-callback`, `eslint-plugin-prefer-arrow`, or `import/no-default-export`), trust a clean lint and don't re-derive it; reason manually only where no rule covers the case.

- **Prefer arrow functions over the `function` keyword — except where a dynamic `this` is genuinely needed.** An arrow function has no `this`, `arguments`, or `prototype` of its own, which is exactly what you want for the common case: a callback, a small transformation, a handler passed around as a value — there it reads as a pure "inputs → output" and sidesteps the classic "lost `this`" bug when a method is detached and called elsewhere. So suggest converting a `function` expression to an arrow when none of those own-binding features are used. The caveat is load-bearing, not cosmetic: keep `function` where the code _relies_ on a dynamically-bound `this` (an object/prototype method invoked as `obj.method()`, a function deliberately `call`/`apply`/`bind`-ed or an event handler that reads `this`), and where you need a generator (`function*`), `arguments`, or declaration hoisting. Those aren't violations — they're the reason `function` still exists. Don't flag them, and when in doubt whether `this` is dynamic, leave it alone.
- **Prefer named exports over a default export — except a React component that must be lazy-loaded.** A named export pins one canonical identifier to the symbol, so every import site spells it the same way: it stays greppable, rename refactors propagate cleanly, and tooling can auto-import it. A default export lets each importer invent its own local name, which fragments the vocabulary and hides usages. So flag an `export default` and propose a named export, updating its import sites in the same patch. The one honest exception is a React component loaded through `React.lazy(() => import('./X'))`, which _requires_ the dynamically-imported module to expose the component as its default — rewriting that to a named export would break the lazy boundary, so leave a component's default export in place when it exists for `lazy`/dynamic-import, and say why.

### Design patterns → `patterns.patch`

Look for code smells that a standard, well-understood pattern would resolve more cleanly. **Read [`references/design-patterns.md`](references/design-patterns.md)** for the catalog — it's a bundled, offline reference (a smell→pattern index plus JS/TS-idiomatic notes, distilled from GoF and Refactoring Guru) so you don't refetch the web each run. Reach for the web only if the change involves a pattern the reference doesn't cover.

When you propose a pattern, name it, explain _why_ this situation calls for it, and **confirm it doesn't add more complexity than it removes** — a pattern applied for its own sake is itself a smell. The bar is: a maintainer would find the patterned version easier to extend, not just more "correct".

### TypeScript idioms → `typescript.patch`

TypeScript-only — skip this dimension entirely for a plain-JavaScript change. There's no `qoq` tool behind it; it's a careful read of the changed `.ts`/`.tsx` files. Three conventions, the first two gated on how modern the project's compile target is, so **read `compilerOptions` from the project's `tsconfig.json` first** (resolve `extends` if a setting isn't defined locally — a base config may set it) and anchor your suggestions to it rather than guessing.

- **Match the syntax to the project's target** — when `module` is `esnext` or `nodenext` (i.e. the project ships modern output), lean into current JavaScript/TypeScript syntax — top-level `await`, `using` for disposables, native ESM `import`, `satisfies`, etc. — because the toolchain already emits it and the older equivalents just add noise. On an older `module`/`target`, hold back: a rewrite the build can't compile is a regression, not an improvement.
- **Prefer immutable (non-mutating) array/object methods** — `arr.toSorted()`, `.toReversed()`, `.toSpliced()`, `.with(i, x)` over the in-place `.sort()`, `.reverse()`, `.splice()` when the original shouldn't be mutated. In-place mutation of a shared array is a classic source of spooky-action-at-a-distance bugs, and the copying variants make intent explicit and keep the input safe to reuse. One caveat tied to the point above: these landed in ES2023, so only suggest them when the project's `target`/`lib` actually includes them — otherwise note the intent (e.g. `[...arr].sort()`) without reaching for syntax the runtime won't have.
- **Demand honest types — no `any`** — `any` switches off the type checker for everything it touches and quietly spreads through the surrounding code, so the types stop describing reality. Flag every `any` the change introduces and propose the real type, a generic, or a narrowed union instead. `unknown` is the escape hatch when a value genuinely can't be typed ahead of time (parsing untrusted input, a truly dynamic boundary) — but it forces a narrowing check before use, so it's safe. Only reach for it once you've confirmed there's no precise type available, and when you do, say so in the report and explain to the user _why_ nothing tighter fits, so they can judge the tradeoff rather than rubber-stamp it.

---

## Phase 3 — Present the plan & get approval

Summarize what each analysis found and what its patch would change — grouped by the seven dimensions, each with a one-line rationale and a sense of size (lines/files touched). Keep it scannable; this is the user's chance to steer.

Then ask whether they want to **edit the plan** (drop or adjust specific patches) or whether you may **execute it**. Wait for an answer. Don't apply anything yet.

---

## Phase 4 — Execution

Apply the approved patches **in sequence**, no subagents — order matters because later patches must apply cleanly on top of earlier ones. Apply lowest-risk first so the riskier changes layer on a known-good base:

1. `spellings.patch`
2. `dependencies.patch`
3. `complexity.patch`
4. `copy_paste.patch`
5. `conventions.patch`
6. `patterns.patch`
7. `typescript.patch`

For each approved patch, in this order:

```bash
git apply --check .qoq-code-review/<name>.patch   # confirm it still applies
git apply .qoq-code-review/<name>.patch
# then run the validation step (lint/test/build from Phase 1)
```

After each apply, run the validation step before moving on, so any breakage points at exactly one patch.

**When a patch no longer applies:** an earlier patch can move the lines a later one targeted, so `git apply --check` fails. Don't force it — regenerate that patch against the current tree using the [Producing a patch](#producing-a-patch) recipe (the source files are already edited from the earlier applies, so just re-do this patch's edits, diff, and restore-the-rest), then apply the fresh one. Only regenerate the patch that actually failed; don't pre-emptively re-derive the others.

If validation goes red after a patch, stop, report which patch broke what, and ask how to proceed rather than pushing through. `git restore` (or reverting the apply) gets you back to the last green state.

---

## Phase 5 — Readability

Highly readable code follows one consistent format so reviewers spend attention on logic, not whitespace. Once all approved patches are in and green, format the changed files with the project's formatter. In QoQ mode prefer `qoq --fix` (or the `qoq:fix` script) — it runs Prettier (and the other auto-fixers) with the project's exact config in one pass. Otherwise **Prettier** is the qoq default (`npm run format`, or `npx prettier --write` on the changed paths; if the project lacks Prettier, suggest `@ladamczyk/qoq-prettier` or the `qoq` CLI). Run the validation step one final time so the formatted result is confirmed green, then summarize what landed.

Finally, clean up so the working tree ends with only the applied, formatted improvements — nothing from the review's scaffolding. Do these two in order:

1. **Remove the workspace.** The `.qoq-code-review/` directory holds only the intermediate patch files and reports and isn't part of the change — `rm -rf .qoq-code-review` to keep it out of the commit.
2. **Revert the `.gitignore` change from Phase 1.** The workspace only needed ignoring while the review ran. Strip the temporary block you added — or delete `.gitignore` entirely if you created it solely for this. When `.gitignore` was already tracked and started clean, `git restore .gitignore` is the quickest exact revert.

Removing the workspace _before_ reverting the ignore rule means the directory is gone by the time it stops being ignored, so it never flashes back into `git status`. The result is a clean tree containing exactly the improvements, ready for the user to commit.

---

## Quick reference

| Dimension          | `qoq` mode (preferred)                            | qoq default               | Generic fallback                          | Patch file           |
| ------------------ | ------------------------------------------------- | ------------------------- | ----------------------------------------- | -------------------- |
| Spelling & naming  | `eslint-report.json` / `qoq eslint` + read        | ESLint naming rule + read | `cspell` / careful read                   | `spellings.patch`    |
| TypeScript idioms  | `tsconfig.json` + careful read (TS projects only) | same                      | same                                      | `typescript.patch`   |
| Dependencies       | `knip-report.json` / `qoq knip`                   | Knip                      | `npx knip`                                | `dependencies.patch` |
| Complexity / SOLID | `eslint-report.json` (`sonarjs/*`) / `qoq eslint` | `eslint-plugin-sonarjs`   | `npx eslint` / `complexity` rule          | `complexity.patch`   |
| Copy-paste         | `jscpd-report.json` / `qoq jscpd`                 | JSCPD                     | `npx jscpd`                               | `copy_paste.patch`   |
| Code conventions   | careful read (JS + TS)                            | same                      | `prefer-arrow` / `no-default-export` lint | `conventions.patch`  |
| Design patterns    | bundled `references/design-patterns.md`           | same                      | same                                      | `patterns.patch`     |
| Formatting         | `qoq --fix` / `qoq:fix`                           | Prettier                  | `npx prettier`                            | (Phase 5)            |

**QoQ mode** = the project has `@ladamczyk/qoq-cli` installed _and_ a `qoq.config.js` at its root (Phase 1, step 5). When on, prime all reports once with `qoq --json --output .qoq-code-review/reports` and have each analysis read its report.

**Validation step** = the project's own lint + test + build commands (in QoQ mode, `qoq --check` / `qoq:check` is the lint gate), verified green in Phase 1 and re-run after every applied patch.
