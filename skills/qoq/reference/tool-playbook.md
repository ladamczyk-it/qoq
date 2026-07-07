# Tool playbook — fixing QoQ findings the QoQ way

Each tool's findings need a different fix strategy and have different traps. Read
only the section for the tool you're fixing. The cardinal rule across all of them:
respect `qoq.config.js`. A "fix" that violates a configured ignore, threshold, or
rule override is not a fix — it's a regression the project deliberately opted out
of.

The digest from `scripts/summarize.mjs` is enough to plan most fixes. Drop to the
raw `*-report.json` only for the specific extra detail a section calls out.

---

## Prettier

**What it reports:** a flat list of files whose formatting differs from the
project's Prettier config (`{ "issues": ["src/a.ts", ...] }`).

**Fix:** there is nothing to analyze — every Prettier finding is auto-fixable by
definition. `qoq --fix` (Phase 2) resolves all of them. If any survive `--fix`,
that's a real signal: usually a syntax error that stops Prettier from parsing the
file, or a file matched by a config the project didn't expect. Open that file and
fix the parse error by hand; don't hand-format to dodge it.

**Trap:** don't reformat files Prettier didn't flag just because you're in them —
that inflates the diff with noise and defeats quality-over-quantity.

---

## ESLint

**What it reports:** standard ESLint JSON — per file, a `messages[]` with
`ruleId`, `severity` (2 = error, 1 = warning), `line`, `column`, and a `fix` key
when ESLint can auto-fix it. The digest groups these by rule and tells you the
count, error/warn split, and how many are auto-fixable.

**Fix order:**

1. **Auto-fixables** are already handled by `qoq --fix` in Phase 2. Anything left
   needs judgment.
2. **Naming-convention** findings (the QoQ templates enforce intention-revealing,
   camelCase/PascalCase names): rename to something that reveals intent and
   matches the convention. Rename the symbol _and all its references_ — a rename
   patch that misses a usage breaks the build, which the Phase 4 gate will catch,
   but it's cheaper to get right the first time.
3. **`@typescript-eslint/no-explicit-any`**: replace `any` with the real type.
   Infer it from usage; reach for `unknown` + a narrowing guard when the value is
   genuinely dynamic. Never silence it with a disable comment unless the project
   already does so nearby for a documented reason.
4. **`sonarjs/cognitive-complexity` and SOLID-flavored rules**: these flag a
   function doing too much. Extract cohesive helpers, replace nested conditionals
   with early returns or guard clauses, split mixed responsibilities. The smallest
   change that gets under the threshold is the right one — don't over-engineer a
   pattern the function doesn't need.
5. Project-specific rules from `eslint.rules` in `qoq.config.js`: read the rule,
   fix to its intent.

**Match the project's conventions** while fixing: QoQ projects prefer arrow
functions over the `function` keyword and named exports over default — if a fix
adds a function or an export, follow suit.

**Trap:** one ESLint patch can touch many files (a renamed export ripples to every
importer). Keep the whole ripple in the _single_ ESLint patch so it applies
atomically; don't split a rename across patches or the intermediate state won't
build.

---

## Knip

**What it reports:** unused files, exports, types, dependencies, devDependencies,
unlisted (imported-but-undeclared) dependencies, unresolved imports, unused
binaries, and unused enum/class members. The digest lists each category with
counts and labels; for an export, the raw report has the precise file and
position if you need it.

**Fix — but verify first, because Knip has false positives:**

- **Unused dependencies / devDependencies:** remove them from `package.json`.
  First confirm `qoq.config.js` `knip.ignoreDependencies` doesn't already cover
  the package (and remember `@ladamczyk/qoq-*` is always ignored by default). A
  dependency used only in a config file, a script, or via a string the static
  analysis can't see is a false positive — keep it and, if appropriate, add it to
  `ignoreDependencies` rather than deleting it.
- **Unlisted dependencies:** the opposite — the code imports a package not declared
  in `package.json`. Add it to the correct dependency block (it's likely surviving
  on a hoisted transitive install, which breaks for consumers).
- **Unused exports / types:** if nothing in the project imports it _and_ it isn't a
  public API entry point, delete the export (or downgrade `export const x` to a
  local `const x` if it's still used in-file). Check `knip.entry` in the config:
  an export reachable from an entry point is intentionally public — don't delete
  it just because it has no internal caller.
- **Unused files:** delete only after confirming nothing references the file —
  including dynamic imports, test setup, and build tooling that Knip's static graph
  may miss. When in doubt, leave it and flag it for the user rather than deleting.

**Trap (the big one):** Knip is the most false-positive-prone tool here. Deleting
"dead" code that a test imports, a build step needs, or a dynamic import reaches
breaks the project in ways the lint gate won't catch — that's why Phase 0 says to
run `test`/`build` after Knip patches. Treat every deletion as a hypothesis the
test/build run must confirm.

---

## JSCPD

**What it reports:** copy-paste clones — pairs of code fragments that duplicate
each other — plus the overall duplication percentage against
`jscpd.threshold`. The digest shows each clone as `fileA:start-end <=> fileB:start-end`
with the line count; the raw report has the actual duplicated `fragment` text.

**Fix:**

- **First check the threshold.** If total duplication is _under_ `jscpd.threshold`,
  the project accepts it — there's nothing to fix. Only act when the percentage is
  over, and then only on the clones that push it over.
- **Extract the shared code** into one well-named function/module and have both
  sites call it. Read the actual fragment from the raw report so the extraction is
  faithful to both copies, not just one.
- **Judgment matters more here than anywhere.** Not every duplicate is worth
  removing — two short blocks that are similar today but model genuinely different
  concepts (incidental duplication) are often clearer left apart than fused behind
  a shared abstraction with a `mode` flag. Extract when the duplication is real and
  the abstraction is honest; otherwise note it and move on. Quality over quantity.

**Trap:** a clone spans two files, so the extraction patch must edit both _and_
introduce the shared unit. Keep all three changes in the single JSCPD patch so it
applies atomically and the gate validates a coherent state.

---

## Stylelint (only when enabled)

**What it reports:** standard Stylelint JSON — per source file, `warnings[]` with
`rule`, `severity`, `line`, and `text`. Many are auto-fixable and already handled
by `qoq --fix`.

**Fix:** for the residue, fix to the rule's intent — order properties, resolve
invalid values, remove duplicate selectors. The QoQ Stylelint templates
(`qoq-stylelint-{css,scss}`) define the rules; if `stylelint.strict` is true in
the config, warnings fail the build and must be cleared, otherwise they're
advisory.

**Trap:** don't restructure CSS the rule didn't flag; keep the patch to the
reported warnings.

---

## Structurelint (only when enabled)

**What it reports:** file/folder structure violations against the project's own
`structure.config.{ts,js,mjs}` — `unexpected` (an entry no rule allows) or
`missing` (a `required` rule with no match), each with a `path` and the
`expected` rule patterns. See [report-schemas.md](report-schemas.md) for the
exact shape.

**Fix:** there is no auto-fix — `qoq --fix` never touches Structurelint findings,
so every violation needs a manual action:

- **`unexpected`** — the entry is in the wrong place or named wrong. Move/rename
  it to match one of the `expected` patterns, or delete it if it shouldn't exist
  at all. Update every import that referenced the old path in the same patch —
  a move that leaves a dangling import breaks the build, which the validation
  gate will catch, but it's cheaper to get right the first time.
- **`missing`** — a `required` rule expected an entry that isn't there (e.g. every
  component folder must have an `index.ts`). Create the missing entry, or drop
  `required` from the rule in `structure.config.*` if the project no longer wants
  to enforce it — that's a config change, not a code fix, so call it out
  separately rather than folding it into the same patch.

**Trap:** a rename ripples to every file that imports the moved path — keep the
whole ripple (the move plus every updated import) in the single Structurelint
patch so it applies atomically. Don't touch entries Structurelint didn't flag,
and don't edit `structure.config.*` to make a violation disappear unless the
rule itself is what's wrong — that silences the check instead of fixing the
structure.
