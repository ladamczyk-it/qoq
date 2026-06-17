# Engine — qoq CLI discovery, reports, and the digest

This is the **shared internal engine**, not a user-facing command. The `review`,
`refactor`, and `bump packages` commands all defer here for one thing: turning
the project's linters and formatters (Prettier, ESLint, Knip, JSCPD, and
Stylelint/Skillslint when enabled) into findings they can act on. It is the
single owner of locating the `qoq` invocation, running it in `--json` mode, and
collapsing the output into a compact digest — so no command re-derives flags or
parses raw reports.

Two ideas shape everything here, and both exist to avoid a specific failure.

**1. Read a digest, never the raw JSON.** An ESLint or JSCPD report on a real
codebase is easily tens of thousands of lines. Loading that into context to "see
the errors" burns tokens for no benefit — the structure is repetitive and most of
it is noise. So a bundled script, `scripts/summarize.mjs`, collapses every report
into one compact digest: counts per tool, grouped by rule, with capped file lists
and an auto-fixable flag. Commands read the digest. They open a specific raw
report only when one finding genuinely needs more detail (the exact clone
fragment, a precise export location) — and then just that slice, not the whole
file. This is the difference between a few hundred tokens and a few hundred
thousand.

**2. The lint gate is `qoq --check` itself.** One command covers every tool, and
it is exactly what the project runs in CI — so it is the trustworthy validation
gate each command re-runs after every applied patch.

## Discovery — how `qoq` is invoked here

Work out how `qoq` runs in this project, preferring the most specific that works:

| Situation                                                   | Command                                       |
| ----------------------------------------------------------- | --------------------------------------------- |
| A `qoq:check` / `qoq:fix` npm script exists                 | `npm run qoq:check` / `npm run qoq:fix`       |
| `@ladamczyk/qoq-cli` installed, no wrapper script           | `npx qoq` (resolves `node_modules/.bin/qoq`)  |
| The QoQ monorepo itself (this repo, `packages/cli` present) | build first (`npm run build`), then `npx qoq` |

Most wrapper scripts already bake in flags, so for the `--json` run prefer calling
the binary directly (`npx qoq …`) and keep the npm script for the `--fix` and
validation gate, where its flags are exactly what CI uses.

**QoQ mode** = `@ladamczyk/qoq-cli` installed _and_ a `qoq.config.js` at the root.
When that holds, the tool-backed findings come from the digest below. When it
doesn't, the project isn't on QoQ — fall back to the project's own
ESLint/Knip/JSCPD/Prettier scripts (or `npx`), say so, and suggest adopting the
`qoq` CLI rather than silently depending on tools the repo hasn't committed to.

## Read the project's contract and config

Two files tell each command how this project wants to be fixed, and reading them
is what makes fixes _dynamic per project_ rather than generic:

- `qoq.config.js` (or `.ts/.mjs/.cjs`) at the project root — thresholds
  (`jscpd.threshold`), ignore lists, the ESLint `template`/`rules` per file group,
  `srcPath`, `knip.ignoreDependencies`, etc. These are the rules to respect; a
  "fix" that violates a configured ignore or threshold is wrong.
- `node_modules/@ladamczyk/qoq-cli/AGENTS.md` — the shipped consumer contract
  (commands, flags, the config schema, where reports land). Read it if unsure of a
  flag or the report layout.

## Produce reports, then read the digest

Run every tool once in JSON mode, writing reports into the shared workspace at
`.qoq/reports/`:

```bash
npx qoq --check --json --output .qoq/reports
```

A non-zero exit just means findings exist — the reports are still written. This
writes `prettier-report.json`, `eslint-report.json`, `knip-report.json`,
`jscpd-report.json` (and `stylelint-report.json` when Stylelint is enabled).

Now collapse them into the digest — **this is the step that keeps tokens low, so
do it instead of reading the raw reports**:

```bash
node <skill>/scripts/summarize.mjs .qoq/reports
```

(`<skill>` is this skill's directory.) The digest groups every finding by tool and
rule, caps the file lists, flags which ESLint/Stylelint rules are auto-fixable,
and prints a total. It exits `1` when there are findings, `0` when clean. Pass
`--json` for a machine-readable summary object, or `--max <n>` to show more
instances per group.

If a finding needs more than the digest gives — the exact duplicated fragment, a
precise unused-export location — open just that tool's raw report and read the
relevant entry, guided by [report-schemas.md](report-schemas.md). Never load a
whole raw report "to be safe".

## Auto-fix first

Most Prettier issues, many ESLint rules, and Stylelint warnings are
machine-fixable, and clearing them first is the project's own canonical fix — it
shrinks the digest to just the findings that need judgment:

```bash
npm run qoq:fix      # or: npx qoq --fix
```

Re-run the reports + digest afterward so what remains is only the residue (Knip
dead code, JSCPD duplication, and the ESLint/Stylelint rules `--fix` can't safely
resolve — naming, complexity, `no-explicit-any`). Those are the patch candidates
the commands turn into reviewable patches.

## Per-tool fix strategy

[tool-playbook.md](tool-playbook.md) holds the per-tool fix strategy (Prettier,
ESLint, JSCPD, Knip, Stylelint) and the false-positive traps — especially Knip
deletions that a test actually imports, and JSCPD extractions that aren't worth
the indirection. Read the section for the tool being fixed.

## Filter to the command's scope

`qoq` runs across the project's configured `srcPath`, not a branch diff or a
chosen sub-path — so every command **filters the digest's findings down to the
files it owns** before turning anything into a patch. Knip dependency findings are
project-wide by nature; report only what the command's scope is responsible for.
`@ladamczyk/qoq-*` deps are always Knip-ignored.
