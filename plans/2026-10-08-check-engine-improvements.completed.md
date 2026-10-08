# check-engine Improvements — completed milestones

Archived from [2026-10-08-check-engine-improvements.md](2026-10-08-check-engine-improvements.md). Append-only.

---

## Milestone 1: Correct, attributed, readable results — delivered 2026-10-08

**Size:** L
**Goal:** The subset bug is fixed, all workspaces are reported before a single exit, every failure names the dependency and the required floor, output is terse, and the repo's own `engines` no longer fail the stricter check.
**Depends on:** none
**Contracts:** All types live in `packages/check-engine/src/helpers/types.ts`. Nullable fields are `T | null`, never optional (`exactOptionalPropertyTypes` + stable JSON).

```ts
export type IncludeFlag = 'dev' | 'peer' | 'optional';
export type DependencyGroup =
  'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';
export interface LtsInfo {
  currentLts: string;
  maintainedLts: string;
}
export type SkipReason = 'not-installed' | 'no-engines' | 'malformed-range';

export interface DependencyRequirement {
  name: string;
  group: DependencyGroup;
  range: string;
} // checked deps only
export interface SkippedDependency {
  name: string;
  group: DependencyGroup;
  reason: SkipReason;
  range: string | null;
} // range only for 'malformed-range'
export interface Conflict {
  dependency: string;
  group: DependencyGroup;
  range: string;
  why: 'not-in-range' | 'not-subset'; // exact vs ranged engines.node
  dependencyFloor: string | null; // semver.minVersion(range)
}
export interface WorkspaceBase {
  path: string; // workspace dir relative to cwd, '.' for root
  packageJsonPath: string; // relative to cwd
  configured: string | null; // raw engines.node, null when absent
  configuredFloor: string | null; // minVersion(configured); null if absent/invalid
  floor: string | null; // required floor, see rule below
  requirements: DependencyRequirement[];
  skipped: SkippedDependency[];
  counts: { checked: number; skipped: number }; // = requirements.length / skipped.length
  advisories: string[]; // always [] in Milestone 1
}
export type WorkspaceResult = WorkspaceBase &
  (
    | { status: 'pass' }
    | { status: 'fail'; reason: 'incompatible'; conflicts: Conflict[] } // non-empty
    | { status: 'fail'; reason: 'invalid-engines' | 'unreadable'; message: string }
  );

// checkEngine.ts — pure compute: no process.exit, no stderr, never throws for per-package problems
export const checkEngine: (packageJsonPath: string) => WorkspaceResult;
// report.ts — pure
export const formatHuman: (results: readonly WorkspaceResult[]) => string;
```

Rules the specs assert against:

- **Compatibility:** `valid(configured)` truthy → `new Range(depRange).test(configured)`; else a valid range → `subset(configured, depRange)` must hold for every checked dependency; neither → `fail` / `invalid-engines`; absent or empty `engines.node` → `pass` (a warning line, as today), `configured: null`.
- **Required floor:** lowest candidate satisfying every dependency range, candidates being `minVersion` of each comparator set of each dependency range (`new Range(r).set`), linear, no cross product. `floor === null` with `requirements.length > 0` means the ranges are mutually unsatisfiable → `fail` / `incompatible`, `conflicts` listing every dependency (criterion 1.2.6). `floor === null` with no requirements means nothing to compute.
- **Dependency groups (Milestone 1):** `dependencies`, falling back to `devDependencies` only when there are no `dependencies`. A name in several groups is reported once, first group wins.
- **Skips:** `getPackageInfo` throws `Package X not installed!` → `not-installed`; no `engines.node` → `no-engines`; `new Range(range)` throws → `malformed-range`. Skips never fail a workspace.
- **Errors:** `readJsonSync` throwing (`ReadFileError`/`JsonParseError`), including a literal workspace path that does not exist → `fail` / `unreadable` with `message`.
- Resolution keeps `getPackageInfo(name, { paths: [resolve(dirname(packageJsonPath))] })`.

**Scenarios:**

- **Given** a package whose `engines.node` is `>=18` and a dependency requiring `>=22`, **When** check-engine runs, **Then** it fails naming that dependency and its range, and shows the required floor.
- **Given** a monorepo where two workspaces fail, **When** check-engine runs, **Then** both are reported and the process exits 1 once, at the end.
- **Given** every workspace compatible, **When** it runs, **Then** it prints one line per workspace with its checked/skipped counts and exits 0.
- **Given** a dependency that is not installed, has no `engines`, or has a malformed range, **When** it runs, **Then** it is counted as skipped (malformed also warned) and does not fail the run.
- **Given** a workspace entry that points at a missing or unparseable `package.json`, **When** it runs, **Then** that workspace fails as `unreadable` and the others are still reported.
- **Given** this repo after the change, **When** `npm run check:engine` runs against the linked build, **Then** it exits 0.

### Ticket 1.1: Align every package's engines

- **Status:** done
- **Size:** S
- **Complexity:** mechanical
- **Agent tier:** `haiku`
- **Estimate:** `mechanical` · stack `monorepo-js` · baseline 0/1
- **Escalation:** none
- **Depends on:** none
- **Files:**
  - Create: `packages/check-engine/src/workspaceEngines.spec.ts`
  - Modify: `package.json`, `package-lock.json`, and the `package.json` of each of: `packages/check-engine`, `packages/cli`, `packages/eslint-v9-js`, `packages/eslint-v9-js-jest`, `packages/eslint-v9-js-jest-rtl`, `packages/eslint-v9-js-react`, `packages/eslint-v9-js-vitest`, `packages/eslint-v9-js-vitest-rtl`, `packages/eslint-v9-ts`, `packages/eslint-v9-ts-jest`, `packages/eslint-v9-ts-jest-rtl`, `packages/eslint-v9-ts-react`, `packages/eslint-v9-ts-vitest`, `packages/eslint-v9-ts-vitest-rtl`, `packages/jscpd`, `packages/knip`, `packages/prettier`, `packages/prettier-with-json-sort`, `packages/stylelint-css`, `packages/stylelint-scss`, `packages/utils`

**Context:** Milestone 1 makes check-engine use `semver.subset`. The repo's own `engines.node` is `>=22.22.2`, which admits Node 23 and 25, so it is not a subset of the installed vitest (`^22.12.0 || ^24.0.0 || >=26.0.0`) or eslint (`^20.19.0 || ^22.13.0 || >=24`) ranges, and `husky:pre-push` (which runs `check:engine` against the linked workspace build) would go red. The user decided all packages, root included, get exactly:
`"engines": { "node": "^22.22.2 || ^24.15.0 || >=26.0.0", "npm": ">= 10" }`.
This is a single scripted sweep (one `node` loop over `package.json` + `packages/*/package.json`), deliberately one ticket despite the file count — splitting it would be 22 identical edits. The lockfile mirrors workspace engines under `packages["<path>"].engines` (root key `""`); update those entries to the same value. Do **not** run `npm install`: it can silently bump unrelated `latest`-pinned versions. After the edit, `git diff --stat package-lock.json` must show only engines lines. Some packages may have an `engines` object with other keys — preserve them.

**Acceptance criteria:**

- [x] the root `package.json` and every `packages/*/package.json` has `engines.node === "^22.22.2 || ^24.15.0 || >=26.0.0"` and `engines.npm === ">= 10"` — `workspaceEngines.spec.ts::workspace engines::%s declares the shared engines`
- [x] every workspace entry (and the root entry `""`) in `package-lock.json` carries the same `engines` values — `workspaceEngines.spec.ts::gives every workspace entry and the root entry in package-lock.json the shared engines`
- [x] the set of checked package.json files equals the set of `packages/*/package.json` on disk plus the root (no workspace skipped) — `workspaceEngines.spec.ts::checks the root plus every workspace the lockfile knows about`

**Definition of done:**

- [x] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [x] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [x] Every acceptance criterion ticked with its evidence pointer
- [x] Change committed after both gates; hash recorded in **Commit** below
- [x] Status set to `done`; advisories (if any) noted below

**Advisories:** none

- **Log:**
  - `2026-10-08 dispatched @ haiku (attempt 1)`
  - `2026-10-08 qoq fix PASS (knip skipped) · tests approved`
  - `2026-10-08 done`

**Commit:** 3d006f5

### Ticket 1.2: Pure checkEngine with attribution and subset

- **Status:** done
- **Size:** M
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural` · stack `monorepo-js` · baseline 0/1
- **Escalation:** none
- **Depends on:** none
- **Files:**
  - Create: `packages/check-engine/src/helpers/types.ts`
  - Modify: `packages/check-engine/src/helpers/checkEngine.ts` (whole file; the `sonarjs/cognitive-complexity` disable on line 1 should go away once split)
  - Test: `packages/check-engine/src/helpers/checkEngine.spec.ts`

**Context:** Today `checkEngine(path, workspaces)` (checkEngine.ts:1-101) writes to stderr and calls `process.exit(1)` at lines 27, 77, 89, and for a ranged `engines.node` uses `Range.intersects` (line 86), which false-passes (`>=18` vs a dependency's `>=22`). Rewrite it to the **Contracts** above: `checkEngine(packageJsonPath: string): WorkspaceResult`, exported types in `types.ts` (the full block under Milestone 1 Contracts; `IncludeFlag`, `LtsInfo` and `advisories` are declared now and populated in Milestone 2 — `advisories` is `[]` here). Use `readJsonSync<PackageJson>(path)` from `./readJson.ts` (it throws `ReadFileError`/`JsonParseError`; catch both → `unreadable`). Use `getPackageInfo(name, { paths })` from `@ladamczyk/qoq-utils` (throws `Package X not installed!`; catch → `not-installed`). `path` in the result is `getRelativePath(dirname(...))`-style relative to cwd, `'.'` for the root. Existing specs mock `@ladamczyk/qoq-utils` partially (`importOriginal` + `getPackageInfo: vi.fn()` cast `as unknown as ReturnType<typeof getPackageInfo>`) and `readJson`; follow that. The old specs assert `ProcessExitError`/stderr text; replace them with assertions on the returned object. Known ceiling: `semver.subset` tests each simple range against one dominating simple range, so `>=22` vs `^22 || >=23` reports false though it is mathematically a subset — add a spec that documents this as expected output.

**Acceptance criteria:**

- [x] `engines.node` `>=18` with a dependency whose engines is `>=22` returns `status: 'fail'`, `reason: 'incompatible'`, and `conflicts[0]` has `dependency` = that name, `range: '>=22'`, `why: 'not-subset'`, `dependencyFloor: '22.0.0'` — `checkEngine.spec.ts::fails a ranged engines.node whose range is not a subset of the dependency range`
- [x] `engines.node` `>=22.22.2` with a dependency `^22.13.0 || ^24.0.0` returns `fail` (it admits 23.x) — `checkEngine.spec.ts::fails when engines.node admits versions the dependency excludes`
- [x] `engines.node` `^22.22.2 || ^24.15.0 || >=26.0.0` with dependency ranges `^22.12.0 || ^24.0.0 || >=26.0.0` and `^20.19.0 || ^22.13.0 || >=24` returns `pass` — `checkEngine.spec.ts::passes the repo-style multi-range engines.node`
- [x] exact `engines.node` `22.22.2` against `^22.13.0 || ^24` returns `pass`, and against `>=24` returns `fail` with `why: 'not-in-range'` — `checkEngine.spec.ts::tests an exact engines.node against the dependency range`
- [x] with two failing dependencies, `conflicts` lists both, each with its own `dependency` and `range` — `checkEngine.spec.ts::lists every failing dependency in conflicts`
- [x] dependency ranges `>=22` and `<20` (mutually unsatisfiable) give `floor: null` and `status: 'fail'`, `reason: 'incompatible'`, with a conflict entry per dependency — `checkEngine.spec.ts::reports mutually unsatisfiable ranges with a null floor and a conflict per dependency`
- [x] `floor` for dependency ranges `>=22.12.0`, `^20.19.0 || ^22.13.0 || >=24`, `>=22.22.2` is `'22.22.2'` — `checkEngine.spec.ts::computes the required floor across all dependency ranges`
- [x] an invalid `engines.node` (`"banana"`) returns `fail`, `reason: 'invalid-engines'`, `configured: 'banana'`, with a non-empty `message` — `checkEngine.spec.ts::fails an invalid engines.node`
- [x] an absent `engines.node` returns `status: 'pass'` with `configured: null` and `configuredFloor: null` — `checkEngine.spec.ts::passes with null configured and configuredFloor when engines.node is absent`
- [x] a dependency whose `getPackageInfo` throws is in `skipped` with `reason: 'not-installed'`; one with no `engines.node` has `reason: 'no-engines'`; one with range `"not a range"` has `reason: 'malformed-range'` and `range: 'not a range'`; none of them fails the workspace and `counts` is `{ checked, skipped }` of the right sizes — `checkEngine.spec.ts::skips uninstalled, engine-less and malformed dependencies without failing`
- [x] with no `dependencies` the `devDependencies` are used; with `dependencies` present the `devDependencies` are ignored; a name in both groups appears once under `dependencies` — `checkEngine.spec.ts::falls back to devDependencies only when there are no dependencies; ::ignores devDependencies when dependencies are present and reports a shared name once`
- [x] an unreadable or unparseable `package.json` (including a path that does not exist) returns `fail`, `reason: 'unreadable'`, with `message` containing the path — `checkEngine.spec.ts::returns unreadable with the path in the message when package.json cannot be read`
- [x] `checkEngine` never calls `process.exit` and never writes to `process.stderr` (spies are not called in any case above) — `checkEngine.spec.ts::never calls process.exit or writes to stderr, on pass, fail or unreadable`

**Definition of done:**

- [x] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [x] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [x] Every acceptance criterion ticked with its evidence pointer
- [x] Change committed after both gates; hash recorded in **Commit** below
- [x] Status set to `done`; advisories (if any) noted below

**Advisories:** index.spec.ts has 3 failing assertions (old two-argument call) until Ticket 1.4 rewrites it; index.ts carries a one-line call-site adapter; types.ts has a file-level `eslint-disable @typescript-eslint/naming-convention` because the contract names have no I/T prefix; JSCPD clone index.ts:18-27 is pre-existing and removed by Ticket 2.1; reviewer notes: AC-12 mocks a plain Error rather than the real ReadFileError/JsonParseError, the ceiling spec asserts status/reason only.

- **Log:**
  - `2026-10-08 dispatched @ sonnet (attempt 1)`
  - `2026-10-08 qoq fix FAIL — prefer-nullish-coalescing checkEngine.ts:102`
  - `2026-10-08 re-dispatched (attempt 2)`
  - `2026-10-08 qoq fix PASS (knip skipped) · tests REJECTED — fallback group asserted as dependencies`
  - `2026-10-08 re-dispatched (attempt 3)`
  - `2026-10-08 qoq fix PASS · tests approved`
  - `2026-10-08 done`

**Commit:** d565a8f

### Ticket 1.3: Terse human report

- **Status:** done
- **Size:** S
- **Complexity:** mechanical
- **Agent tier:** `sonnet`
- **Estimate:** `mechanical` · stack `monorepo-js` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 1.2
- **Files:**
  - Create: `packages/check-engine/src/helpers/report.ts`
  - Test: `packages/check-engine/src/helpers/report.spec.ts`

**Context:** `formatHuman(results: readonly WorkspaceResult[]): string` is pure — it returns text; the caller writes it to stderr. The `WorkspaceResult` shape is in Milestone 1 **Contracts** (`types.ts`, created by Ticket 1.2). Use `picocolors` (`import c from 'picocolors'`, already a dependency). Target look, one line per workspace, path then configured range then counts:
`✔ packages/foo  >=22.22.2  (12 checked, 3 skipped)` (green).
A failing `incompatible` workspace prints `✖ packages/foo  >=18  (…)` (red), then a short aligned table with columns `dependency`, `requires`, `floor` (one row per conflict, `floor` = `dependencyFloor`), then `required floor: <floor>` (or `required floor: none — dependency ranges are mutually unsatisfiable` when `floor` is null). `invalid-engines`/`unreadable` print `✖ path  <message>`. A pass with `configured: null` prints `✔ path  no engines.node configured — add one` in yellow. Skipped entries with `reason: 'malformed-range'` print `⚠ <name> has a malformed engines.node range "<range>" (skipped)` in yellow under their workspace. No banner, no verbose dump, no "criteria!." typo. Strip colour in specs by asserting on `picocolors`-free substrings (or use `NO_COLOR`-independent `toContain`).

**Acceptance criteria:**

- [x] a passing result renders as one line containing its `path`, its `configured` range, `12 checked` and `3 skipped` for `counts` `{ checked: 12, skipped: 3 }` — `report.spec.ts::renders a passing result as one line with path, range and counts`
- [x] a result list of three passing workspaces renders exactly three non-empty lines — `report.spec.ts::renders three passing workspaces as exactly three non-empty lines`
- [x] an `incompatible` result lists, for each conflict, the dependency name, its range and its `dependencyFloor`, and the line `required floor: 22.22.2` when `floor` is `'22.22.2'` — `report.spec.ts::lists each conflict with name, range and floor, plus the required floor`
- [x] an `incompatible` result with `floor: null` renders `required floor: none` — `report.spec.ts::renders required floor: none when floor is null`
- [x] an `invalid-engines` and an `unreadable` result each render the `path` and the `message` — `report.spec.ts::renders path and message for %s`
- [x] a `malformed-range` skip renders a warning line containing the dependency name and the bad range, under its workspace — `report.spec.ts::renders a malformed-range skip as a warning under its workspace`
- [x] the output contains neither `CHECK ENGINE` nor `criteria!.` — `report.spec.ts::prints neither the old banner nor the old typo`

**Definition of done:**

- [x] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [x] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [x] Every acceptance criterion ticked with its evidence pointer
- [x] Change committed after both gates; hash recorded in **Commit** below
- [x] Status set to `done`; advisories (if any) noted below

**Advisories:** table regexes in report.spec.ts are colour-fragile (assume no ANSI under vitest; FORCE_COLOR would break the `$`-anchored rows); the malformed-range test uses a single workspace.

- **Log:**
  - `2026-10-08 dispatched @ sonnet (attempt 1)`
  - `2026-10-08 qoq fix PASS (knip skipped) · tests REJECTED — dependencyFloor assertion was a substring of the range`
  - `2026-10-08 re-dispatched (attempt 2)`
  - `2026-10-08 qoq fix PASS · tests approved`
  - `2026-10-08 done`

**Commit:** fa840dc

### Ticket 1.4: Collect every workspace, exit once

- **Status:** done
- **Size:** M
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural` · stack `monorepo-js` · baseline 0/1
- **Escalation:** none
- **Depends on:** Ticket 1.2, Ticket 1.3
- **Files:**
  - Modify: `packages/check-engine/src/index.ts:13-48`
  - Test: `packages/check-engine/src/index.spec.ts`
  - Modify: `packages/check-engine/AGENTS.md`, `packages/check-engine/CLAUDE.md`

**Context:** The default command action (index.ts:13-48) builds `pathsToCheck` (keep that discovery code exactly as it is — Milestone 2 replaces it), writes a banner (line 40), calls `fetchNodeInfo('./node.json')` and prints two LTS lines (42-45), then calls `checkEngine(entry, pathsToCheck.length > 1)` per path (47). New action: map `checkEngine(path)` over every path (no workspace boolean), write `formatHuman(results)` to `process.stderr`, set `process.exitCode = 1` if any result has `status: 'fail'` — never call `process.exit`. **Stop calling `fetchNodeInfo` entirely in this milestone** (no banner, no LTS lines): the lookup returns in Milestone 2 behind `--no-lts`, and until then offline runs must not throw. `index.spec.ts` currently mocks `node:fs` as `{ existsSync, readdirSync }` only and mocks `./helpers/checkEngine.ts` and `./helpers/fetchNodeInfo.ts`; also mock `./helpers/report.ts`'s `formatHuman`; the runner helper `run(...argv)` calls `cli.parse([...], { run: false })` then `await cli.runMatchedCommand()`. **`process.exitCode` leaks into vitest's own exit status**: the spec must set `process.exitCode = undefined` in `afterEach`. Docs: `AGENTS.md` and `CLAUDE.md` of the package describe the banner, the LTS lines, `process.exit` and the old behaviour — update exactly those lines (output is now one line per workspace, exit 1 once at the end, stricter range check). The LTS lookup is gone until Milestone 2 restores it: remove the docs' claims that the run prints LTS versions, and do not document the removal as a feature.

**Acceptance criteria:**

- [x] with no `workspaces`, `checkEngine` is called once with `'./package.json'` and only that argument — `index.spec.ts::should check only the root package.json when there are no workspaces`
- [x] with a literal workspace `libs/foo` and a glob `packages/*` matching one directory, `checkEngine` is called for `'./package.json'`, `'libs/foo'` and the glob match, in that order, each with exactly one argument — `index.spec.ts::should check root, literal workspace and glob match in order`
- [x] when two of three `checkEngine` results are `fail`, `formatHuman` receives all three results and `process.exitCode` is `1` — `index.spec.ts::should pass every result to formatHuman and set exitCode 1 when any fail`
- [x] when all results are `pass`, `process.exitCode` stays unset (`undefined`) — `index.spec.ts::should leave exitCode unset when all results pass`
- [x] the output written to `process.stderr` is exactly the string returned by `formatHuman` (no banner, no `CHECK ENGINE`) — `index.spec.ts::should write exactly the formatHuman output to stderr`
- [x] `process.exit` is never called, and `fetchNodeInfo` is never called — `index.spec.ts::should never call process.exit or fetchNodeInfo`

**Definition of done:**

- [x] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [x] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [x] Every acceptance criterion ticked with its evidence pointer
- [x] Change committed after both gates; hash recorded in **Commit** below
- [x] Status set to `done`; advisories (if any) noted below

**Advisories:** index.spec.ts line 82 asserts `resolveCwdPath` was called with '/packages/' — Ticket 2.1 replaces discovery and must drop that assertion; process.exitCode leaks into vitest's exit status, so any spec that triggers a fail path needs the afterEach reset; JSCPD clone index.ts:18-27 still present until Ticket 2.1.

- **Log:**
  - `2026-10-08 dispatched @ sonnet (attempt 1)`
  - `2026-10-08 qoq fix PASS (knip skipped) · tests approved`
  - `2026-10-08 done`

**Commit:** 2ab5fbd

### Ticket 1.5: Root engines track the strictest dev dependency

- **Status:** done
- **Size:** XS
- **Complexity:** mechanical
- **Agent tier:** `haiku`
- **Estimate:** `mechanical` · stack `monorepo-js` · baseline 0/2
- **Escalation:** none
- **Depends on:** none
- **Files:**
  - Modify: `package.json`, `package-lock.json`
  - Test: `packages/check-engine/src/workspaceEngines.spec.ts`

**Context:** Found by the Milestone 1 gate: running the built `check-engine` on this repo fails the root, because root `engines.node` `^22.22.2 || ^24.15.0 || >=26.0.0` admits Node 27+ while the root devDependency `lerna` declares `^22.13.0 || ^24.0.0 || ^26.0.0`. The user decided the root only (private tooling) gets `engines.node` `^22.22.2` (and `engines.npm` stays `">= 10"`). Every `packages/*/package.json` keeps `^22.22.2 || ^24.15.0 || >=26.0.0`. The lockfile root entry is the `""` key under `packages`; update only its `engines.node`. Do **not** run `npm install`. `workspaceEngines.spec.ts` (Ticket 1.1) currently asserts the shared string for the root and for the lockfile `""` entry: change those two expectations to `^22.22.2` and leave the workspace expectations as they are.

**Acceptance criteria:**

- [x] the root `package.json` has `engines.node === "^22.22.2"` and `engines.npm === ">= 10"` — `workspaceEngines.spec.ts::root package.json declares the root engines`
- [x] the `""` entry of `package-lock.json` has `engines.node === "^22.22.2"` and `engines.npm === ">= 10"` — `workspaceEngines.spec.ts::gives every workspace entry the shared engines and the root entry in package-lock.json the root engines (key === "")`
- [x] every `packages/*/package.json` and its lockfile entry still has `engines.node === "^22.22.2 || ^24.15.0 || >=26.0.0"` and `engines.npm === ">= 10"` — `workspaceEngines.spec.ts::%s declares the shared engines; ::gives every workspace entry the shared engines and the root entry in package-lock.json the root engines`

**Definition of done:**

- [x] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [x] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [x] Every acceptance criterion ticked with its evidence pointer
- [x] Change committed after both gates; hash recorded in **Commit** below
- [x] Status set to `done`; advisories (if any) noted below

**Advisories:** workspaceEngines.spec.ts derives the expected lockfile keys from the lockfile itself; an absent `""` entry would not fail AC-2 (add `expect(workspaceKeys).toContain('')`).

- **Log:**
  - `2026-10-08 dispatched @ haiku (attempt 1)`
  - `2026-10-08 qoq fix PASS (knip skipped) · tests approved`
  - `2026-10-08 done`

**Commit:** 9d4be02

### Ticket 1.6: Report ends with a newline

- **Status:** done
- **Size:** XS
- **Complexity:** mechanical
- **Agent tier:** `sonnet`
- **Estimate:** `mechanical` · stack `monorepo-js` · baseline 0/2
- **Escalation:** none
- **Depends on:** none
- **Files:**
  - Modify: `packages/check-engine/src/helpers/report.ts`
  - Test: `packages/check-engine/src/helpers/report.spec.ts`

**Context:** Found by the Milestone 1 gate: the CLI writes `formatHuman(results)` to stderr verbatim (Ticket 1.4 asserts the stderr write is exactly the `formatHuman` return value), and `formatHuman` currently returns lines joined by `\n` with no trailing newline, so the shell prompt lands on the last workspace's line. Fix it in `formatHuman` (not in `index.ts`): when there is at least one line, the returned string ends with exactly one `\n`; for an empty `results` it returns `''`. The existing `report.spec.ts` tests split the output on `\n` and filter empty lines or anchor rows with `$`; keep them green (adjust only a split that would now see a trailing empty element, never an expectation about content).

**Acceptance criteria:**

- [x] `formatHuman` of one passing result returns a string that ends with exactly one `\n` (and not `\n\n`) — `report.spec.ts::ends a passing report with exactly one newline`
- [x] `formatHuman` of a failing `incompatible` result (table plus `required floor`) ends with exactly one `\n` — `report.spec.ts::ends an incompatible report with exactly one newline`
- [x] `formatHuman([])` returns `''` — `report.spec.ts::returns an empty string for no results`

**Definition of done:**

- [x] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [x] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [x] Every acceptance criterion ticked with its evidence pointer
- [x] Change committed after both gates; hash recorded in **Commit** below
- [x] Status set to `done`; advisories (if any) noted below

**Advisories:** the empty-result test is a regression guard (it passed before the change); the newline tests cover no warning-last result.

- **Log:**
  - `2026-10-08 dispatched @ sonnet (attempt 1)`
  - `2026-10-08 qoq fix FAIL — prettier report.ts; fixed on the orchestrating thread`
  - `2026-10-08 qoq fix PASS (knip skipped) · tests approved`
  - `2026-10-08 done`

**Commit:** 697861c

### Milestone 1 — Definition of done

- [ ] All tickets above are `done`
- [ ] `qoq refactor --decisions auto <union of every ticket's Files above>` → clean. This is the milestone's refactor beat, and the only scope where cross-ticket findings are visible at all. Pass the union explicitly; bare, it widens to the whole project
- [ ] Project's full build + full test suite green (the Commands header above)
- [ ] `npm run build` then `npm run check:engine` exits 0 against the linked workspace build (the real-world proof that the repo passes its own stricter check)
- [ ] All results written into the summary block's **Gate evidence**
- [ ] Milestone archived: full text moved to `2026-10-08-check-engine-improvements.completed.md`, summary block left under `## Completed`, downstream tickets' **Context** updated with anything this milestone actually established
