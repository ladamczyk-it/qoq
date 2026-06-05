---
name: npm-bump-packages
description: >-
  Safely update/upgrade a project's npm dependencies in stages — minor/patch
  bumps first, then major bumps one major version at a time with changelog
  research and code refactoring. Use this skill whenever the user wants to
  update, upgrade, or bump npm packages/dependencies, mentions `npm outdated`,
  says their deps are stale/out of date, wants to "get on the latest versions",
  or asks to modernize/refresh a project's dependencies — even if they don't
  say the word "safely". Built around a plan-then-execute flow: every change is
  staged as a reviewable git patch, validated against the project's own
  lint/test/build commands, and applied incrementally so a bad bump is easy to
  isolate and revert.
allowed-tools:
  - Bash(npm outdated *)
  - Bash(npm run:*)
  - Bash(npm i *)
  - Bash(mkdir -p .npm-bump)
  - Bash(git checkout:*)
  - Bash(git apply *)
---

# npm-bump-packages

Updating dependencies is dangerous when done all at once: if 30 packages move and the build breaks, you have no idea which one did it. This skill exists to make upgrades **boring and recoverable**. The core idea is a clean separation between _planning_ and _executing_:

- **Plan**: gather everything, write each change as a git patch file, and get the user's sign-off — without touching the working tree.
- **Execute**: apply patches one at a time, reinstall, and run the project's own validation after each, so any breakage is attributable to a single patch and trivially reverted.

Two failure modes drive this design. First, **silent breakage** — a bump that compiles but changes behavior; the antidote is running the project's real lint/test/build after every step. Second, **unattributable breakage** — applying many changes together so you can't tell what broke; the antidote is one-patch-at-a-time application. Optimize for those, not for speed.

A note on autonomy: this is a workflow that mutates a real repo and reinstalls dependencies. Stop and ask at the marked decision points rather than pushing through. If the user has stated upfront preferences (which packages to exclude, whether to apply changes, whether subagents are allowed), honor them and don't re-ask.

---

## Phase 0 — Establish a safety net

Before anything changes, make sure you can tell "working" from "broken" and that you can get back to a clean state.

1. **Confirm a clean working tree.** Run `git status`. If there are uncommitted changes, point them out and ask whether to proceed anyway, stash them, or stop — you don't want to entangle your bumps with unrelated edits, and you rely on `git` to revert.

2. **Discover the validation commands.** You need three things: how to **lint/format**, how to **test**, and how to **build**. Read `package.json` `scripts` and any project docs (`README`, `CLAUDE.md`, `AGENTS.md`). Prefer scripts the project already defines over commands you invent. If anything is ambiguous, ask the user rather than guessing. Together these are the project's **full validation** — the gold-standard signal you trust after every bump.

3. **Profile the tooling for a faster validation loop.** The full suite is the safety net, but running all of it after every single patch is often wasteful — a patch that only touches an ESLint plugin can't break your tests. Before execution, spend a little time learning what the validation tools can actually do, so the per-patch loop in Phase 5 can run the _smallest trustworthy_ check instead of the whole suite every time. Two capabilities pay off the most:
   - **Selective execution** — running a single underlying tool or a subset rather than the entire suite. Many tools expose this. For example `qoq` CLI, runs one tool on demand: `qoq eslint --check` lints without touching Prettier, JSCPD, Knip, or the rest. When a patch's blast radius is clearly one tool, validating with just that tool is dramatically faster and still fully attributable.
   - **Structured (machine-readable) output** — a `--json` / `--format json` mode. Parsing failures out of JSON is more reliable and far cheaper on context than scraping console text. `qoq --check --json --output <dir>` writes each tool's result as JSON, for instance.

   Don't guess at these flags — **read the tools' own docs**, since that's where the time savings are documented and the exact invocation lives. Check `<tool> --help`, the package README, and any agent-oriented docs shipped inside `node_modules` (e.g. `node_modules/@ladamczyk/qoq-cli/AGENTS.md` documents `qoq`'s per-tool invocation and `--json` output). Record a small mapping for yourself: which command validates each concern (lint/format, types, tests, build) and the structured-output form of each. That mapping is your **fast validation** menu, used throughout Phase 5.

   This profiling needs `node_modules` in place but is otherwise independent of the baseline run in step 4, so do the two **in parallel**: kick off the install + baseline validation, and while it churns, read the docs and assemble the fast-validation menu. (A subagent is a natural fit here if the user has allowed them — one reads docs while the main thread waits on the baseline.)

4. **Install and verify the baseline is green.** Make sure dependencies are installed (`npm install`) so `node_modules` reflects the current versions — discovery, profiling, and validation all depend on it. Then run each **full validation** command _before_ modifying anything. If a command already fails on a clean tree, surface it and ask how to proceed — otherwise you'll later misattribute a pre-existing failure to a bump. (If the user explicitly says validation is known-broken and to proceed, record which commands to skip.)

Set up a working directory for patch files: `.npm-bump/` at the repo root. It's a scratch directory — the patches exist only to stage and isolate each bump during the run, so once every bump has landed and validated they've served their purpose and get removed automatically (see Phase 6).

---

## Phase 1 — Discovery

Run discovery and categorize what's available:

```bash
npm outdated --json
```

`npm outdated` exits non-zero when packages are outdated — that's expected, not an error; capture the JSON regardless. Each entry has `current`, `wanted`, `latest`, and `dependent`/location info. Read `package.json` to learn whether each package is a `dependencies` or `devDependencies` entry (don't infer it from `npm outdated` alone).

Split findings into two groups by the semver jump from the **current installed version** to **latest**:

- **Minor / Patch** — same major version (safe and quick)
  - devDependencies
  - dependencies
- **Major** — major version increases (may need refactoring)
  - devDependencies
  - dependencies

Present the findings to the user as a clear table per group (package, current → latest, dep type). Then **ask whether they want to exclude any packages** from the bump. Wait for approval before planning.

Once they've approved the scope, **ask whether you may spawn subagents** to speed up planning (one per major package is a natural split). If yes and subagents are available, parallelize the per-package research in Phase 3. Execution (Phase 5) is always sequential regardless.

---

## Phase 2 — Plan the safe (minor / patch) bumps

These stay within the current major, so by semver they shouldn't break anything — but you still validate them.

Produce two git patches that bump the approved minor/patch packages to **latest**, editing only the version ranges in `package.json` (and `package.json` files of workspaces, if applicable). Keep the prefix style the project already uses (`^`, `~`, or pinned).

- `.npm-bump/safe_dev.patch` — the `devDependencies` bumps
- `.npm-bump/safe.patch` — the `dependencies` bumps

Generate patches without dirtying the tree: edit, `git diff > patch`, then restore. For example:

```bash
# after editing package.json for the dev bumps:
git diff -- package.json > .npm-bump/safe_dev.patch
git checkout -- package.json   # restore so the tree stays clean until execution
```

If there's nothing to bump in a group, skip that patch and note it.

---

## Phase 3 — Plan the major bumps (one package at a time)

Majors are where breakage lives. Handle **each package separately** and never collapse multiple majors into one jump.

### Step through one major at a time

If a package is more than one major behind, plan a separate patch for each major step, closest-to-latest. Example — project on `1.2.3`, latest `4.0.0`:

- `1.2.3` → `^2`
- `^2` → `^3`
- `^3` → `4.0.0`

This isolates breaking changes to a single major boundary, which is exactly where changelogs document them, and keeps each refactor small and reviewable.

### Identify breaking changes

For each step, consult the package's **changelog / release notes / migration guide** (its repo, `CHANGELOG.md`, or GitHub releases — `npm view <pkg> repository.url` finds the repo; `gh release list`/`WebFetch` help). Note the breaking changes that actually affect this project — renamed/removed APIs, config format changes, dropped Node/runtime support, changed defaults.

### Analyze project usage and plan minimal changes

Find how the project actually uses the package (imports, config files, API calls). Cross-reference against the breaking changes and plan the **minimal** code edits needed to stay working — bump the version range _and_ make just enough source/config changes to match. Don't opportunistically refactor unrelated code.

Stage each step as its own patch (version bump + the matching code changes together, so the patch is self-consistent):

- `.npm-bump/DEV_<PACKAGE>_<FROM>_<TO>.patch` — for a `devDependencies` package
- `.npm-bump/<PACKAGE>_<FROM>_<TO>.patch` — for a `dependencies` package

where `<PACKAGE>` is the name, `<FROM>` is the version bumping from (e.g. `1.2.3`), `<TO>` is the target (e.g. `2.0.0`). Sanitize scoped names for filenames — `@scope/pkg` → `scope__pkg` (replace `@`/`/` to keep the filename valid). Generate the same clean way as the safe patches (edit → `git diff > patch` → `git checkout --`).

---

## Phase 4 — Present the plan

Summarize the full plan for the user before any execution:

- The safe patches and what they bump.
- For each major package: the version steps, the breaking changes that matter, and the code changes you'll make at each step (with file references).
- Any coupling you detected (see Considerations).

Ask whether they want to modify the plan or whether you may execute it. Don't proceed to Phase 5 without approval.

---

## Phase 5 — Execution

Apply patches **sequentially**, no subagents. After every single patch: reinstall, confirm install success, then validate. The loop is identical for every patch — only the order differs.

Validate each patch with the smallest trustworthy check from your Phase 0 **fast validation** menu: pick the tool(s) the patch can actually affect and prefer their structured-output form. But when the blast radius is wide or unclear — a runtime `dependencies` bump, a TypeScript or Node-level change, or a tool that everything leans on — don't gamble; run the **full validation**. Fast validation trades coverage for speed _without_ giving up attribution (you're still applying one patch at a time), so the only question to ask each time is "am I sure which tools this patch can touch?" — if not, spend the full suite.

**The per-patch loop:**

1. `git apply .npm-bump/<patch>` (if it fails to apply cleanly — e.g. an earlier patch shifted line numbers — regenerate it against the current tree rather than forcing it).
2. `npm i`. Confirm it succeeds. **If it errors**, stop and tell the user what failed; ask whether to attempt a fix or abort. (npm surfaces peer-dependency conflicts here — see Considerations.)
3. Validate — **fast validation** scoped to the patch by default, **full validation** when the blast radius is wide or unclear (see above). **If anything fails**, stop, show the failure, and ask whether to attempt a fix or abort.

Only move to the next patch once the current one installs and validates cleanly. This is what makes a bad bump attributable to exactly one patch and revertible with a single `git checkout`/`git apply -R`.

### Order of application

1. **`safe_dev.patch`** — run the loop.
2. **`safe.patch`** — run the loop.
3. **Major patches**, in this order:
   - devDependencies before dependencies,
   - grouped by package name (all steps of one package together),
   - oldest → newest version within each package.

When the last patch has applied and validated, run one **full validation** pass as a backstop — per-patch fast validation deliberately skips tools, so this final end-to-end sweep is cheap insurance that the whole suite is still green together. Once it passes, the bump is complete — proceed to Phase 6.

---

## Phase 6 — Clean up

A bump only reaches here if **every** patch applied and validated cleanly. At that point the patches in `.npm-bump/` are spent — they were scaffolding to isolate each change, and the changes now live in the working tree. So remove the whole scratch directory automatically, no need to ask:

```bash
rm -rf .npm-bump/
```

The one thing that keeps this safe is the precondition: clean up only on a fully successful run. If execution stopped early — a patch failed to apply, an install errored, or validation went red and the user chose to abort — **leave `.npm-bump/` in place**. The remaining patches are exactly the record of what's left to do and what to inspect, so deleting them would throw away the trail. Cleanup is the reward for a green run, not a step you do regardless.

After removing the directory, summarize what changed (which packages moved and to what versions) and offer to commit.

---

## Considerations — coupled & namespaced packages

Some packages must move together or installs break and behavior diverges. Account for this when building patches and when fixing errors:

- **Peer-coupled packages** (e.g. `react` + `react-dom`, `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`, `eslint` + its plugins) must share a compatible version. Bump them in the **same patch**, not separately. `npm i` will warn or error on peer mismatches — treat that as a signal you split a coupled set.
- **Same-namespace packages** are often released together under one tag and should be kept in sync (e.g. all `@ladamczyk/qoq-*` to the same version). Bump the whole set to the same version in one patch.

When in doubt about whether two packages are coupled, check their `peerDependencies` and changelogs before splitting them across patches.

---

## Patch file quick reference

All patches live in `.npm-bump/`:

| Patch                         | Contents                                   | Applied                           |
| ----------------------------- | ------------------------------------------ | --------------------------------- |
| `safe_dev.patch`              | minor/patch bumps of devDependencies       | 1st                               |
| `safe.patch`                  | minor/patch bumps of dependencies          | 2nd                               |
| `DEV_<PKG>_<FROM>_<TO>.patch` | one major step of a devDependency (+ code) | dev majors, by pkg, oldest→newest |
| `<PKG>_<FROM>_<TO>.patch`     | one major step of a dependency (+ code)    | dep majors, by pkg, oldest→newest |

Scoped names sanitized for filenames: `@scope/pkg` → `scope__pkg`.
