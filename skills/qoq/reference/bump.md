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

**Tooling.** The linters and formatters are the **engine**'s job, not this command's.
This command owns the bump workflow (discovery, staging, sequential application); it
does **not** detect a `qoq` CLI, invent its flags, or parse raw reports. For the
lint/format half of validation, defer to [engine.md](engine.md), already located during
Setup — the single owner of the `qoq` invocation, its `--json` output, per-tool
selective execution, and the digest. If a project has no `qoq` set up at all, the
engine's fallback applies: use the project's own ESLint/Knip/JSCPD/Prettier scripts (or
`npx`), say so, and continue; test and build discovery is this command's own job
regardless.

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

Set up the shared workspace for patch files: `.qoq/` at the repo root
(`mkdir -p .qoq`). It's a scratch directory — the patches exist only to stage and
isolate each bump during the run, so once every bump has landed and validated they get
removed automatically (Phase 6). Keep it out of `git status` and the engine's Prettier
gate the same way the other commands do: append a labeled block to `.gitignore` (create
it if absent), noting whether you **created** the file or **appended** so the Phase 6
revert is unambiguous:

```gitignore
# QoQ workspace — temporary, removed when the run finishes
.qoq/
```

---

## Phase 1 — Discovery

Run discovery and categorize what's available:

```bash
npm outdated --json
```

`npm outdated` exits non-zero when packages are outdated — that's expected, not an
error; capture the JSON regardless. Each entry has `current`, `wanted`, `latest`, and
`dependent`/location info. Read `package.json` to learn whether each package is a
`dependencies` or `devDependencies` entry (don't infer it from `npm outdated` alone).

Split findings into two groups by the semver jump from the **current installed
version** to **latest**:

- **Minor / Patch** — same major version (safe and quick)
  - devDependencies
  - dependencies
- **Major** — major version increases (may need refactoring)
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

Generate patches without dirtying the tree: edit, `git diff > patch`, then restore:

```bash
# after editing package.json for the dev bumps:
git diff -- package.json > .qoq/safe_dev.patch
git checkout -- package.json   # restore so the tree stays clean until execution
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
same clean way as the safe patches (edit → `git diff > patch` → `git checkout --`).

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
the patches in `.qoq/` are spent. So remove the whole scratch directory
automatically, no need to ask:

```bash
rm -rf .qoq/
```

Then revert the `.gitignore` block you added in Phase 0 — strip the labeled
`.qoq/` block, or delete `.gitignore` entirely if you created it solely for this run
(`git restore .gitignore` is the quickest exact revert when it was already tracked and
started clean). Remove the workspace _before_ reverting the ignore rule so the directory
is gone by the time it stops being ignored and never flashes back into `git status`.

The one thing that keeps this safe is the precondition: clean up only on a fully
successful run. If execution stopped early — a patch failed to apply, an install errored,
or validation went red and the user chose to abort — **leave `.qoq/` and its `.gitignore`
block in place**. The remaining patches are exactly the record of what's left to do.
Cleanup is the reward for a green run, not a step you do regardless.

After removing the directory, summarize what changed (which packages moved and to what
versions) and offer to commit.

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
