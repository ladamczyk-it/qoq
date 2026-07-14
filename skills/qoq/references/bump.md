# bump packages

Updating dependencies is dangerous when done all at once: if 30 packages move and the
build breaks, you have no idea which one did it. This command exists to make upgrades
**boring and recoverable**. The core idea is a clean separation between _planning_ and
_executing_:

- **Plan**: gather everything, write each change as a git patch file, and get the
  user's sign-off — without touching the working tree.
- **Execute**: apply patches one at a time, reinstall, and run the project's own
  validation after each, so any breakage is attributable to a single patch and
  trivially reverted.

Two failure modes drive this design. First, **silent breakage** — a bump that compiles
but changes behavior; the antidote is running the project's real lint/test/build after
every step. Second, **unattributable breakage** — applying many changes together so you
can't tell what broke; the antidote is one-patch-at-a-time application.

## Table of contents

- [Phase 0 — Establish a safety net](#phase-0--establish-a-safety-net)
- [Phase 1 — Discovery](#phase-1--discovery)
- [Phase 2 — Plan the safe (minor / patch) bumps](#phase-2--plan-the-safe-minor--patch-bumps)
- [Phase 3 — Plan the major bumps (one package at a time)](#phase-3--plan-the-major-bumps-one-package-at-a-time)
- [Phase 4 — Present the plan](#phase-4--present-the-plan)
- [Phase 5 — Execution](#phase-5--execution)
- [Phase 6 — Clean up](#phase-6--clean-up)
- [Considerations — coupled & namespaced packages](#considerations--coupled--namespaced-packages)
- [Patch file quick reference](#patch-file-quick-reference)

**Tooling.** The linters and formatters — and, via the CLI's `npm` module, the
outdated-package scan itself — are the **engine**'s job, not this command's. This
command owns the bump workflow (staging, sequential application, and deciding what to
_do_ about what's outdated); it does **not** detect a `qoq` CLI, invent its flags, run
`npm outdated` itself, or re-derive the major/minor/patch split from raw output — that
categorization already lives in the CLI's `NpmExecutor`, and duplicating it here is how
the two drift out of sync. Defer to [engine.md](engine.md), already located during
Setup — the single owner of the `qoq` invocation, its `--json` output (including
`npm-report.json`), per-tool selective execution, and the digest. If a project has no
`qoq` set up at all, the engine's fallback applies: use the project's own
ESLint/Knip/JSCPD/Prettier scripts (or `npx`) for lint/format, and fall back to a
direct `npm outdated --json` for discovery (Phase 1 covers exactly how); say so, and
continue. Test and build discovery is this command's own job regardless.

---

## Phase 0 — Establish a safety net

Setup already confirmed a clean working tree. The rest is bump-specific.

1. **Discover the validation commands.** You need three things: how to **lint/format**,
   how to **test**, and how to **build**. Together they are the project's **full
   validation** — the gold-standard signal you trust after every bump:
   - **Lint/format — hand discovery to the engine.** Don't detect a CLI, invent flags,
     or parse raw reports here; follow [engine.md](engine.md) to find how `qoq` runs
     here — the `qoq:check` / `qoq:fix` script, `npx qoq`, or build-first in the QoQ
     monorepo. The lint/format gate is `qoq` itself: one `qoq --check` covers Prettier,
     ESLint, Knip, and JSCPD together. Only when the engine can't run (no `qoq` set up)
     do you fall back to the project's own ESLint/Knip/JSCPD/Prettier scripts.
   - **Test and build — your own discovery.** The engine doesn't cover these. Read
     `package.json` `scripts` and any project docs (`README`, `CLAUDE.md`, `AGENTS.md`);
     prefer scripts the project already defines over commands you invent. If anything is
     ambiguous, ask rather than guessing.

2. **Profile the tooling for a faster validation loop.** The full suite is the safety
   net, but running all of it after every single patch is often wasteful — a patch that
   only touches an ESLint plugin can't break your tests. Before execution, learn what
   the validation tools can do, so the per-patch loop in Phase 5 can run the _smallest
   trustworthy_ check. Two capabilities pay off most:
   - **Selective execution** — running a single underlying tool rather than the entire
     suite. For the lint/format gate this is the engine's territory: it already discovers
     `qoq`'s per-tool invocation (e.g. `qoq eslint --check` lints without touching the
     rest) from `node_modules/@ladamczyk/qoq-cli/AGENTS.md`. For test/build, check
     whether the runner supports running a subset.
   - **Structured (machine-readable) output** — a `--json` / `--format json` mode.
     Parsing failures out of JSON is more reliable and far cheaper on context than
     scraping console text. For lint/format this is again the engine's
     `qoq --check --json --output <dir>` (read via its digest); for test/build, note any
     equivalent reporter the runner offers.

   Record a small mapping for yourself: which command validates each concern (lint/format
   via the engine, types, tests, build) and the structured-output form of each. That
   mapping is your **fast validation** menu, used throughout Phase 5.

   This profiling needs `node_modules` in place but is otherwise independent of the
   baseline run in step 3, so do the two **in parallel**: kick off the install +
   baseline validation, and while it churns, follow the engine's discovery and assemble
   the fast-validation menu. (A subagent is a natural fit here if the user has allowed
   them.)

3. **Install and verify the baseline is green.** Make sure dependencies are installed
   (`npm install`) so `node_modules` reflects the current versions. Then run each **full
   validation** command _before_ modifying anything. If a command already fails on a
   clean tree, surface it and ask how to proceed — otherwise you'll later misattribute a
   pre-existing failure to a bump. (If the user explicitly says validation is
   known-broken and to proceed, record which commands to skip.)

Set up the shared workspace for patch files
([workflow.md](workflow.md#the-workspace--qoq)):

```bash
node <skill>/scripts/workspace.mjs init
```

It's a scratch directory — the patches exist only to stage and isolate each bump
during the run, so once every bump has landed and validated they get removed
automatically (Phase 6).

---

## Phase 1 — Discovery

Discovery means finding out what's outdated — and in **QoQ mode**
([engine.md](engine.md)'s term for "`@ladamczyk/qoq-cli` installed and a
`qoq.config.js` at the root"), that's the engine's `npm` module, not a raw
`npm outdated` call this command parses itself. The module already does the semver
comparison and buckets each package into `major` / `minor` / `patch` — read that
instead of re-deriving it, so bump's categorization can never disagree with what
`qoq --check` reports elsewhere in the project.

1. **QoQ mode — run the engine, scoped to just the npm tool.** The npm module
   throttles itself (`npm.checkOutdatedEvery`, 1 day by default) via a lock file at
   `node_modules/@ladamczyk/qoq-cli/bin/.npm-outdated-lock` (or
   `packages/cli/bin/.npm-outdated-lock` in the QoQ monorepo itself) — inside that
   window it silently skips the check and writes no report at all. Every other
   command is indifferent to this (none of them read npm findings), but `bump`'s
   entire job depends on live data, so clear the lock first:

   ```bash
   rm -f node_modules/@ladamczyk/qoq-cli/bin/.npm-outdated-lock
   npx qoq npm --json --output .qoq/reports
   ```

   (the `npm` positional arg scopes the run to that one tool — no reason to pay for
   Prettier/ESLint/Knip/JSCPD when all you need is the outdated list.) A non-zero
   exit just means outdated packages exist, same as every other `qoq` tool — the
   report is still written. Read `.qoq/reports/npm-report.json` directly (schema in
   [report-schemas.md](report-schemas.md)): `{ major, minor, patch }`, each an array
   of `{ name, current, latest }`, already deduped across workspaces and classified
   by semver jump. It's small enough to read straight — no need to route it through
   `scripts/summarize.mjs` unless you're already pulling the digest for something
   else in the same run.

2. **No `qoq` set up — fall back to a direct check.** Per the engine's fallback:

   ```bash
   npm outdated --json
   ```

   `npm outdated` exits non-zero when packages are outdated — expected, not an
   error; capture the JSON regardless. Each entry has `current`, `wanted`, `latest`.
   Bucket by the semver jump from **current** to **latest** the same way the engine
   does: same major → `minor`/`patch`, major increase → `major`.

3. **Classify by dependency type.** Neither `npm-report.json` nor raw
   `npm outdated` says whether a package is a `dependencies` or `devDependencies`
   entry — cross-reference each name against `package.json` (and workspace
   `package.json` files, if applicable).

Group the results the way the rest of this command uses them:

- **Minor / Patch** (the `minor` + `patch` buckets) — same major version, safe and
  quick
  - devDependencies
  - dependencies
- **Major** (the `major` bucket) — may need refactoring
  - devDependencies
  - dependencies

Present the findings to the user as a clear table per group (package, current → latest,
dep type). Then **ask whether they want to exclude any packages** from the bump. Wait
for approval before planning.

Once they've approved the scope, **ask whether you may spawn subagents** to speed up
planning (one per major package is a natural split). If yes and subagents are available,
parallelize the per-package research in Phase 3. Execution (Phase 5) is always
sequential regardless.

---

## Phase 2 — Plan the safe (minor / patch) bumps

These stay within the current major, so by semver they shouldn't break anything — but
you still validate them.

Produce two git patches that bump the approved minor/patch packages to **latest**,
editing only the version ranges in `package.json` (and `package.json` files of
workspaces, if applicable). Keep the prefix style the project already uses (`^`, `~`, or
pinned).

- `.qoq/safe_dev.patch` — the `devDependencies` bumps
- `.qoq/safe.patch` — the `dependencies` bumps

Generate patches without dirtying the tree — edit the `package.json`(s), then
stage with the shared script ([workflow.md](workflow.md#staging-a-patch)),
which captures the diff, restores the tree, and verifies the patch applies:

```bash
# after editing package.json for the dev bumps:
node <skill>/scripts/stage-patch.mjs safe_dev -- package.json 'packages/*/package.json'
```

If there's nothing to bump in a group, skip that patch and note it.

---

## Phase 3 — Plan the major bumps (one package at a time)

Majors are where breakage lives. Handle **each package separately** and never collapse
multiple majors into one jump.

### Step through one major at a time

If a package is more than one major behind, plan a separate patch for each major step,
closest-to-latest. Example — project on `1.2.3`, latest `4.0.0`:

- `1.2.3` → `^2`
- `^2` → `^3`
- `^3` → `4.0.0`

This isolates breaking changes to a single major boundary, which is exactly where
changelogs document them, and keeps each refactor small and reviewable.

### Identify breaking changes

For each step, consult the package's **changelog / release notes / migration guide**
(its repo, `CHANGELOG.md`, or GitHub releases — `npm view <pkg> repository.url` finds the
repo; `gh release list`/`WebFetch` help). Note the breaking changes that actually affect
this project — renamed/removed APIs, config format changes, dropped Node/runtime support,
changed defaults.

### Analyze project usage and plan minimal changes

Find how the project actually uses the package (imports, config files, API calls).
Cross-reference against the breaking changes and plan the **minimal** code edits needed to
stay working — bump the version range _and_ make just enough source/config changes to
match. Don't opportunistically refactor unrelated code.

Stage each step as its own patch (version bump + the matching code changes together, so
the patch is self-consistent):

- `.qoq/DEV_<PACKAGE>_<FROM>_<TO>.patch` — for a `devDependencies` package
- `.qoq/<PACKAGE>_<FROM>_<TO>.patch` — for a `dependencies` package

where `<PACKAGE>` is the name, `<FROM>` is the version bumping from, `<TO>` is the
target. Sanitize scoped names for filenames — `@scope/pkg` → `scope__pkg`. Generate the
same clean way as the safe patches (edit, then `stage-patch.mjs` — a major-step patch
often carries source/config edits alongside `package.json`; pass every touched path).

---

## Phase 4 — Present the plan

Summarize the full plan for the user before any execution:

- The safe patches and what they bump.
- For each major package: the version steps, the breaking changes that matter, and the
  code changes you'll make at each step (with file references).
- Any coupling you detected (see Considerations).

Ask whether they want to modify the plan or whether you may execute it. Don't proceed to
Phase 5 without approval.

---

## Phase 5 — Execution

Apply patches **sequentially**, no subagents. After every single patch: reinstall,
confirm install success, then validate. The loop is identical for every patch — only the
order differs.

Validate each patch with the smallest trustworthy check from your Phase 0 **fast
validation** menu: pick the tool(s) the patch can actually affect and prefer their
structured-output form. But when the blast radius is wide or unclear — a runtime
`dependencies` bump, a TypeScript or Node-level change, or a tool that everything leans
on — don't gamble; run the **full validation**.

**The per-patch loop:**

1. `git apply .qoq/<patch>` (if it fails to apply cleanly — e.g. an earlier patch
   shifted line numbers — regenerate it against the current tree rather than forcing it).
2. `npm i`. Confirm it succeeds. **If it errors**, stop and tell the user what failed;
   ask whether to attempt a fix or abort. (npm surfaces peer-dependency conflicts here —
   see Considerations.)
3. Validate — **fast validation** scoped to the patch by default, **full validation**
   when the blast radius is wide or unclear. **If anything fails**, stop, show the
   failure, and ask whether to attempt a fix or abort.

Only move to the next patch once the current one installs and validates cleanly. This is
what makes a bad bump attributable to exactly one patch and revertible with a single
`git checkout`/`git apply -R`.

### Order of application

1. **`safe_dev.patch`** — run the loop.
2. **`safe.patch`** — run the loop.
3. **Major patches**, in this order:
   - devDependencies before dependencies,
   - grouped by package name (all steps of one package together),
   - oldest → newest version within each package.

When the last patch has applied and validated, run one **full validation** pass as a
backstop — per-patch fast validation deliberately skips tools, so this final end-to-end
sweep is cheap insurance that the whole suite is still green together. Once it passes,
proceed to Phase 6.

---

## Phase 6 — Clean up

A bump only reaches here if **every** patch applied and validated cleanly. At that point
the patches in `.qoq/` are spent — remove the workspace and revert the ignore rule in one
step, no need to ask ([workflow.md](workflow.md#cleanup)):

```bash
node <skill>/scripts/workspace.mjs cleanup
```

The one thing that keeps this safe is the precondition: clean up only on a fully
successful run. If execution stopped early — a patch failed to apply, an install errored,
or validation went red and the user chose to abort — **leave `.qoq/` and its `.gitignore`
block in place**. The remaining patches are exactly the record of what's left to do.
Cleanup is the reward for a green run, not a step you do regardless.

After cleanup, summarize what changed (which packages moved and to what versions) and
offer to commit.

---

## Considerations — coupled & namespaced packages

Some packages must move together or installs break and behavior diverges:

- **Peer-coupled packages** (e.g. `react` + `react-dom`, `@typescript-eslint/parser` +
  `@typescript-eslint/eslint-plugin`, `eslint` + its plugins) must share a compatible
  version. Bump them in the **same patch**, not separately. `npm i` will warn or error on
  peer mismatches — treat that as a signal you split a coupled set.
- **Same-namespace packages** are often released together under one tag and should be kept
  in sync (e.g. all `@ladamczyk/qoq-*` to the same version). Bump the whole set to the
  same version in one patch.

When in doubt about whether two packages are coupled, check their `peerDependencies` and
changelogs before splitting them across patches.

---

## Patch file quick reference

All patches live in `.qoq/`:

| Patch                         | Contents                                   | Applied                           |
| ----------------------------- | ------------------------------------------ | --------------------------------- |
| `safe_dev.patch`              | minor/patch bumps of devDependencies       | 1st                               |
| `safe.patch`                  | minor/patch bumps of dependencies          | 2nd                               |
| `DEV_<PKG>_<FROM>_<TO>.patch` | one major step of a devDependency (+ code) | dev majors, by pkg, oldest→newest |
| `<PKG>_<FROM>_<TO>.patch`     | one major step of a dependency (+ code)    | dep majors, by pkg, oldest→newest |

Scoped names sanitized for filenames: `@scope/pkg` → `scope__pkg`.
