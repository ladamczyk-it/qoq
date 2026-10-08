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

---

## Milestone 2: Scoping, LTS advisory, discovery and machine output — delivered 2026-10-08

**Size:** L
**Goal:** `--include`, glob-based workspace discovery, a safe LTS lookup with an advisory and `--no-lts`, and `--json` / `--quiet`.
**Depends on:** Milestone 1
**Contracts:** Extends Milestone 1's `types.ts` / `report.ts` / `checkEngine.ts` (those files are the base; do not redefine the types). `IncludeFlag` and `LtsInfo` were removed from `types.ts` by the Milestone 1 gate (Knip: unused until consumed) — Ticket 2.2 re-adds `export type IncludeFlag = 'dev' | 'peer' | 'optional'` and Ticket 2.3 re-adds `export interface LtsInfo { currentLts: string; maintainedLts: string }` (exported, consumed in the same ticket).

```ts
// checkEngine.ts
export interface CheckOptions {
  include: readonly IncludeFlag[];
  lts: LtsInfo | null;
}
export const checkEngine: (packageJsonPath: string, options?: CheckOptions) => WorkspaceResult;
//   options omitted ⇒ { include: [], lts: null }

// findWorkspaces.ts (new)
export const findWorkspaces: (cwd: string, workspaces: PackageJson['workspaces']) => string[];
//   package.json paths relative to cwd, root './package.json' first then sorted, deduped.
//   accepts string[] | { packages?: string[] }; '!pattern' entries are excludes; node_modules always excluded.

// report.ts
export interface Report {
  ok: boolean;
  lts: LtsInfo | null;
  workspaces: WorkspaceResult[];
} // workspaces sorted by path
export const buildReport: (results: readonly WorkspaceResult[], lts: LtsInfo | null) => Report;
export const formatHuman: (
  results: readonly WorkspaceResult[],
  opts?: { quiet: boolean }
) => string;

// fetchNodeInfo.ts (signature unchanged)
export const fetchNodeInfo: (path: string) => Promise<LtsInfo>;
```

Rules:

- **Groups:** default exactly as Milestone 1 (dependencies, devDependencies fallback only when no dependencies). `include` adds `dev` → devDependencies, `peer` → peerDependencies, `optional` → optionalDependencies on top of the default; the fallback still applies. Precedence for a name in several groups: dependencies, dev, peer, optional.
- **Advisory:** when `lts` is non-null and `configuredFloor` is non-null and `major(configuredFloor) < major(lts.maintainedLts)`, push `engines.node floor <configuredFloor> is below the maintained LTS (v<major>)` to `advisories`. Majors only. Never affects `status` or the exit code. `lts: null` ⇒ `advisories` stays `[]`.
- **`fetchNodeInfo`:** `AbortSignal.timeout(3000)` on the nodejs.org fetch; a non-OK response or any failure falls back to the `path` file (`./node.json`); if both fail it **throws** an `Error` whose message contains all of: `https://nodejs.org/download/release/index.json`, `./node.json`, `project root`, `--no-lts`.
- **CLI:** options `--include <list>` (comma-separated, values `dev|peer|optional`; anything else ⇒ one-line usage error to stderr, `process.exitCode = 1`, nothing else runs), `--no-lts` (cac's negation: `options.lts === false` skips the lookup entirely; `lts` is `null` in `checkEngine` options and in the `Report`), `--json` (one `JSON.stringify(report, null, 2) + '\n'` to **stdout**; human text stays on stderr), `--quiet` (human output suppressed on success, including warnings and advisories; failures still print; `--json --quiet` still writes the full document to stdout). LTS is fetched once per run.

**Scenarios:**

- **Given** a package with `devDependencies` and `dependencies`, **When** run with `--include dev`, **Then** the devDependencies are checked too.
- **Given** `workspaces: { "packages": ["packages/**", "!packages/legacy"] }`, **When** it runs, **Then** `packages/legacy` is excluded and nested `node_modules` packages are never treated as workspaces.
- **Given** an offline machine with no `node.json`, **When** run without `--no-lts`, **Then** it throws with an explicit instruction to download `node.json` into the project root (or pass `--no-lts`); with `--no-lts` it runs normally.
- **Given** an `engines.node` floor below the maintained LTS, **When** it runs, **Then** an advisory is printed and the exit code is unaffected.
- **Given** `--json`, **When** it runs, **Then** stdout is valid JSON of the result and stderr carries the human text; **given** `--quiet` on a passing repo, **Then** nothing is printed.

### Ticket 2.1: Glob-based workspace discovery

- **Status:** done
- **Size:** M
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural` · stack `monorepo-js` · baseline 0/1
- **Escalation:** none
- **Depends on:** none
- **Files:**
  - Create: `packages/check-engine/src/helpers/findWorkspaces.ts`
  - Modify: `packages/check-engine/src/index.ts:13-38`
  - Test: `packages/check-engine/src/helpers/findWorkspaces.spec.ts`, `packages/check-engine/src/index.spec.ts`

**Context:** index.ts:14-38 expands only flat `*` globs by hand with `readdirSync`/`existsSync`, casts `workspaces as string[]` (the `{ packages: [...] }` form crashes at `.reduce`), and passes literal paths verbatim. Replace it with `findWorkspaces` built on `globSync` from `node:fs` (typed in `@types/node` 22; engines floor makes it available; no new dependency). **Unverified assumptions you must prove with a real run, not mocks:** `exclude` does not support `!`-prefixed patterns (strip the `!` and pass the pattern as an exclude); whether an exclude pattern prunes the whole subtree and what the function-form `exclude` receives (a basename or a path); whether `globSync` emits an ExperimentalWarning on Node 22.22. `**/node_modules/**` must always be excluded — this repo has `packages/cli/node_modules/typescript/package.json`. A literal workspace path (no glob characters) must be returned verbatim as `<path>/package.json` even if it does not exist, so `checkEngine` reports it `unreadable` (Milestone 1 rule). Tests of discovery use a real tmp directory (`mkdtempSync` under `os.tmpdir()`), not a mocked `fs`; remove the `node:fs` mock from `index.spec.ts` and mock `./helpers/findWorkspaces.ts` there instead. Milestone 1 established: the CLI sets `process.exitCode` (never `process.exit`); `index.spec.ts` line ~82 asserts `resolveCwdPath` was called with '/packages/' — drop that assertion with the old discovery; `checkEngine` reports a literal workspace whose `package.json` is missing as `unreadable`.

**Acceptance criteria:**

- [x] in a tmp fixture with `packages/a/package.json` and `packages/b/package.json`, `findWorkspaces(cwd, ['packages/*'])` returns `['./package.json', 'packages/a/package.json', 'packages/b/package.json']` — `findWorkspaces.spec.ts::should return the root first, then the glob matches sorted`
- [x] `findWorkspaces(cwd, { packages: ['packages/*'] })` returns the same list as the array form — `findWorkspaces.spec.ts::should accept the { packages } object form`
- [x] with nested `packages/x/y/package.json`, the pattern `packages/**` returns it, and a `packages/x/node_modules/dep/package.json` is never returned — `findWorkspaces.spec.ts::should match nested packages with ** and never return node_modules`
- [x] `['packages/**', '!packages/legacy']` excludes `packages/legacy/package.json` and everything under it — `findWorkspaces.spec.ts::should treat !pattern as an exclude of the whole subtree`
- [x] a literal `libs/missing` (no such directory) is returned as `libs/missing/package.json` — `findWorkspaces.spec.ts::should return a literal path verbatim even when it does not exist`
- [x] a directory without a `package.json` matched by a glob is not returned — `findWorkspaces.spec.ts::should skip glob-matched directories without a package.json`
- [x] results are deduplicated and sorted, the root first — `findWorkspaces.spec.ts::should deduplicate overlapping patterns`
- [x] calling `findWorkspaces` emits no Node `ExperimentalWarning` (listen on `process.on('warning')`, await one tick, assert none) — `findWorkspaces.spec.ts::should emit no Node warning on the first globSync use in a fresh process`
- [x] the CLI action passes the root `package.json`'s `workspaces` value to `findWorkspaces` and calls `checkEngine` once per returned path — `index.spec.ts::should pass the root workspaces value to findWorkspaces and check each returned path`

**Definition of done:**

- [x] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [x] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [x] Every acceptance criterion ticked with its evidence pointer
- [x] Change committed after both gates; hash recorded in **Commit** below
- [x] Status set to `done`; advisories (if any) noted below

**Advisories:** `!` excludes apply only to glob matches, not to literal workspace paths (literals are returned verbatim); the warning test loads a `.ts` file through Node type stripping, so a Node version whose type stripping itself warns would fail it for an unrelated reason; the developer used `npm exec -- prettier --write` once in attempt 1 (a way around the qoq-only rule for package runners) — attempt 2 used qoq only.

- **Log:**
  - `2026-10-08 dispatched @ sonnet (attempt 1)`
  - `2026-10-08 qoq fix PASS (knip skipped) · tests REJECTED — ExperimentalWarning test could pass vacuously (once-per-process warning)`
  - `2026-10-08 re-dispatched (attempt 2)`
  - `2026-10-08 qoq fix PASS · tests approved`
  - `2026-10-08 done`

**Commit:** 45ebc52

### Ticket 2.2: `--include` dependency groups

- **Status:** done
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `mechanical` · stack `monorepo-js` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 2.1
- **Files:**
  - Modify: `packages/check-engine/src/helpers/checkEngine.ts`, `packages/check-engine/src/index.ts`
  - Test: `packages/check-engine/src/helpers/checkEngine.spec.ts`, `packages/check-engine/src/index.spec.ts`
  - Modify: `packages/check-engine/AGENTS.md`

**Context:** Add `CheckOptions` (Milestone 2 **Contracts**) to `checkEngine` and a cac option `--include <list>` on the default command in `index.ts` (`cli.command('', …).option('--include <list>', …)`; cac gives `options.include` as a string). Parse by splitting on commas; validate against `dev|peer|optional`; an unknown value writes a one-line error to `process.stderr` naming the bad value and the allowed ones, sets `process.exitCode = 1` and runs nothing. Document the flag in the package `AGENTS.md`. Milestone 1 already reports `group: 'devDependencies'` for the devDependencies fallback; `IncludeFlag` is declared by this ticket (it was removed from `types.ts` by the Milestone 1 gate).

**Acceptance criteria:**

- [x] `checkEngine(path, { include: ['dev'], lts: null })` checks `devDependencies` in addition to `dependencies`, with `group: 'devDependencies'` on those entries — `checkEngine.spec.ts::adds devDependencies for include dev`
- [x] `include: ['peer']` and `include: ['optional']` add `peerDependencies` / `optionalDependencies` entries with the matching `group` — `checkEngine.spec.ts::adds peerDependencies and optionalDependencies with the matching group`
- [x] with no `dependencies` and `include: ['peer']`, `devDependencies` are still used (fallback preserved) alongside peers — `checkEngine.spec.ts::keeps the devDependencies fallback alongside peers when dependencies is empty`
- [x] a name present in `dependencies` and `peerDependencies` appears once, under `dependencies` — `checkEngine.spec.ts::lists a name present in several groups once, under the highest-precedence group`
- [x] omitting `options` behaves exactly as Milestone 1 (spy-free equality with the no-flag result) — `checkEngine.spec.ts::behaves as before when options are omitted`
- [x] `--include dev,peer` calls `checkEngine` with `include: ['dev', 'peer']` for every workspace — `index.spec.ts::should call checkEngine with the parsed include list for every workspace`
- [x] `--include banana` writes one stderr line containing `banana`, sets `process.exitCode` to `1`, and does not call `checkEngine` — `index.spec.ts::should reject an unknown include value without running anything`

**Definition of done:**

- [x] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [x] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [x] Every acceptance criterion ticked with its evidence pointer
- [x] Change committed after both gates; hash recorded in **Commit** below
- [x] Status set to `done`; advisories (if any) noted below

**Advisories:** `CheckOptions.lts` uses an inline structural type until Ticket 2.3 declares `LtsInfo`; the no-flag path still calls `checkEngine(path)` with no options (Ticket 2.4 passes options unconditionally and updates those assertions, and index.spec.ts:126 hardcodes `lts: null`); `--include dev,` / empty value is rejected as unknown, untested; the unknown-value message is not asserted to list the allowed values; `CheckOptions` carries a line-level eslint-disable for its contract name.

- **Log:**
  - `2026-10-08 dispatched @ sonnet (attempt 1)`
  - `2026-10-08 qoq fix FAIL — naming-convention on CheckOptions; formatting + lint fixed on the orchestrating thread`
  - `2026-10-08 qoq fix PASS (knip skipped) · tests approved`
  - `2026-10-08 done`

**Commit:** 9b17c92

### Ticket 2.3: Safe LTS fetch

- **Status:** done
- **Size:** S
- **Complexity:** mechanical
- **Agent tier:** `sonnet`
- **Estimate:** `mechanical` · stack `monorepo-js` · baseline 0/0
- **Escalation:** none
- **Depends on:** none
- **Files:**
  - Modify: `packages/check-engine/src/helpers/fetchNodeInfo.ts:21-33`
  - Test: `packages/check-engine/src/helpers/fetchNodeInfo.spec.ts`

**Context:** fetchNodeInfo.ts calls `fetch('https://nodejs.org/download/release/index.json')` with no timeout (line 22), does not check `response.ok`, falls back to `readJsonSync(path)`, and throws `"Can't read … + no 'node.json' present in root!"` (lines 30-32). Change per the **Contracts** rule: 3000 ms `AbortSignal.timeout`, `response.ok` check, same fallback, and a new thrown message containing the four required fragments. The existing spec stubs `fetch` with `vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(data) }))` and mocks `./readJson.ts`; the stubbed response needs `ok: true` after this change. Line 55 of the spec asserts the old error string; update it. This ticket (re-)declares and exports `LtsInfo` in `types.ts` (removed by the Milestone 1 gate) and `fetchNodeInfo` returns it.

**Acceptance criteria:**

- [x] `fetch` is called with an `AbortSignal` (`expect.any(AbortSignal)`) — `fetchNodeInfo.spec.ts::calls fetch with an AbortSignal`
- [x] a non-OK response (`ok: false`) falls back to the `path` file — `fetchNodeInfo.spec.ts::falls back to the local snapshot when the response is not OK`
- [x] a rejected fetch falls back to the `path` file — `fetchNodeInfo.spec.ts::falls back to the local snapshot when the fetch fails`
- [x] when fetch fails and the file read throws, the rejection message contains `https://nodejs.org/download/release/index.json`, `./node.json`, `project root` and `--no-lts` — `fetchNodeInfo.spec.ts::(both sources fail) rejects with the four-fragment instruction message`
- [x] with a successful fetch the returned `currentLts` and `maintainedLts` are unchanged from today's behaviour for the existing fixture — `fetchNodeInfo.spec.ts::(success path) returns currentLts v20.1.0 and maintainedLts v18.1.0`

**Definition of done:**

- [x] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [x] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [x] Every acceptance criterion ticked with its evidence pointer
- [x] Change committed after both gates; hash recorded in **Commit** below
- [x] Status set to `done`; advisories (if any) noted below

**Advisories:** fetchNodeInfo.spec.ts line 34 relies on test order (afterEach only restores mocks; add `vi.clearAllMocks()`); the 3000 ms timeout value is not pinned; `CheckOptions.lts` in checkEngine.ts still uses the inline structural type — Ticket 2.4 swaps in `LtsInfo`.

- **Log:**
  - `2026-10-08 dispatched @ sonnet (attempt 1)`
  - `2026-10-08 qoq fix PASS (knip skipped; formatting applied on the orchestrating thread) · tests approved`
  - `2026-10-08 done`

**Commit:** bab4666

### Ticket 2.4: LTS advisory and `--no-lts`

- **Status:** done
- **Size:** M
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural` · stack `monorepo-js` · baseline 0/1
- **Escalation:** none
- **Depends on:** Ticket 2.2, Ticket 2.3
- **Files:**
  - Modify: `packages/check-engine/src/helpers/checkEngine.ts`, `packages/check-engine/src/helpers/report.ts`, `packages/check-engine/src/index.ts`
  - Test: `packages/check-engine/src/helpers/checkEngine.spec.ts`, `packages/check-engine/src/helpers/report.spec.ts`, `packages/check-engine/src/index.spec.ts`
  - Modify: `packages/check-engine/AGENTS.md`, `packages/check-engine/CLAUDE.md`

**Context:** Milestone 1 removed the `fetchNodeInfo` call from `index.ts`; this ticket restores it, once per run, before the workspace map, skipped when cac's `options.lts === false` (`--no-lts`; cac defaults `options.lts` to `true`). Pass `{ include, lts }` to every `checkEngine`. `checkEngine` fills `advisories` per the **Contracts** advisory rule (`major` from `semver`). `formatHuman` prints each advisory on the workspace's line group in yellow, `⚠ <advisory>`. A thrown `fetchNodeInfo` error propagates (the instruction message is the point); do not catch it. The advisory never affects `status` or `process.exitCode`. Docs: AGENTS.md currently claims a "bundled `node.json` snapshot in the package root" — that is false (nothing ships one, `files` is `["bin","AGENTS.md"]`); replace it with: download `https://nodejs.org/download/release/index.json` to `./node.json` in the project root when offline, or use `--no-lts`. Document `--no-lts` and the advisory. CLAUDE.md: update the helper list. Milestone 1 established: `formatHuman` returns each line followed by `\n` (empty results → `''`), so advisory lines must be added as lines, not appended after the join; the CLI writes the return value to stderr verbatim. Also update `packages/check-engine/CLAUDE.md`: it still says workspace globs are expanded via `readdirSync` — Ticket 2.1 replaced that with `findWorkspaces` (`node:fs` `globSync`). Established by Tickets 2.2/2.3: `CheckOptions.lts` in `checkEngine.ts` currently uses the inline type `{ currentLts: string; maintainedLts: string } | null` — replace it with the exported `LtsInfo` from `types.ts`. Until now `index.ts` calls `checkEngine(path)` with no options when `--include` is absent; from this ticket the CLI ALWAYS passes `{ include, lts }` to every `checkEngine` call, so the Milestone 1/2 assertions in `index.spec.ts` that expect `checkEngine` to be called with the path only (and the `--include` tests that hardcode `lts: null`) must change to the new argument shape — that call-argument shape is the only thing about those assertions you may change.

**Acceptance criteria:**

- [x] `checkEngine(path, { include: [], lts: { currentLts: 'v24.13.0', maintainedLts: 'v22.13.1' } })` with `engines.node` `>=20.0.0` has `advisories` equal to one entry containing `20.0.0` and `v22` — `checkEngine.spec.ts::advises when the configured floor is below the maintained LTS major`
- [x] with `engines.node` `>=22.22.2` and the same `lts`, `advisories` is `[]` — `checkEngine.spec.ts::gives no advisory when the floor is at the maintained LTS major`
- [x] with `lts: null`, `advisories` is `[]` and `status` is unchanged — `checkEngine.spec.ts::gives no advisory without lts info and leaves status unchanged`
- [x] an advisory never changes `status` (a passing workspace with an advisory is still `pass`) — `checkEngine.spec.ts::keeps a passing workspace with an advisory as pass`
- [x] `formatHuman` renders each advisory as its own line containing the advisory text — `report.spec.ts::renders each advisory as its own line`
- [x] by default the CLI calls `fetchNodeInfo('./node.json')` exactly once for a multi-workspace run and passes the result as `lts` to every `checkEngine` call — `index.spec.ts::should fetch the LTS info once and pass it to every checkEngine call`
- [x] with `--no-lts` the CLI never calls `fetchNodeInfo` and passes `lts: null` — `index.spec.ts::should skip the LTS lookup and pass lts null with --no-lts`
- [x] when `fetchNodeInfo` rejects, the action rejects with that error and `checkEngine` is not called — `index.spec.ts::should reject with the fetchNodeInfo error and not call checkEngine`

**Definition of done:**

- [x] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [x] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [x] Every acceptance criterion ticked with its evidence pointer
- [x] Change committed after both gates; hash recorded in **Commit** below
- [x] Status set to `done`; advisories (if any) noted below

**Advisories:** the advisory fires on any floor whose major is below the maintained LTS major — once Ticket 2.6 lowers consumer floors it will fire on most published packages (decision pending: opt-in or drop); index.spec.ts fetch-once uses deep equality, so a copied `lts` object would not be caught.

- **Log:**
  - `2026-10-08 dispatched @ sonnet (attempt 1)`
  - `2026-10-08 qoq fix PASS (knip skipped; formatting applied on the orchestrating thread) · tests approved`
  - `2026-10-08 done`

**Commit:** b0ea0f3

### Ticket 2.5: `--json` and `--quiet`

- **Status:** done
- **Size:** S
- **Complexity:** mechanical
- **Agent tier:** `sonnet`
- **Estimate:** `mechanical` · stack `monorepo-js` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 2.4
- **Files:**
  - Modify: `packages/check-engine/src/helpers/report.ts`, `packages/check-engine/src/index.ts`
  - Test: `packages/check-engine/src/helpers/report.spec.ts`, `packages/check-engine/src/index.spec.ts`
  - Modify: `packages/check-engine/AGENTS.md`, `packages/check-engine/README.md`

**Context:** Add `buildReport(results, lts)` (sorts `workspaces` by `path`, `ok` = no `fail`) and the `opts?: { quiet: boolean }` parameter to `formatHuman` to the Contracts above. In `index.ts` add `--json` and `--quiet` options: `--json` writes `JSON.stringify(report, null, 2) + '\n'` to `process.stdout`; human text always goes to stderr; `--quiet` suppresses all human output when every workspace passes (including warnings and advisories), but failures still print in full; `--json --quiet` still writes the full document. `process.exitCode` logic from Milestone 1 is unchanged. Document both flags in AGENTS.md and give README one line pointing at `--json`. Milestone 1 established: `formatHuman` returns lines each followed by `\n` and `''` for no results — `--quiet` must return `''` for an all-passing run, and failing output keeps the trailing newline.

**Acceptance criteria:**

- [x] `buildReport` returns `ok: true` when every result passes and `ok: false` when any fails — `report.spec.ts::is ok when every result passes; ::is not ok when any result fails`
- [x] `buildReport` sorts `workspaces` by `path` regardless of input order and carries `lts` through (`null` stays `null`) — `report.spec.ts::sorts workspaces by path regardless of input order; ::carries lts through, null stays null`
- [x] `formatHuman(passingResults, { quiet: true })` returns `''` even when a result has skipped malformed ranges and advisories — `report.spec.ts::returns an empty string for passing results with warnings and advisories`
- [x] `formatHuman(mixedResults, { quiet: true })` still contains the failing workspace's lines — `report.spec.ts::still prints the failing workspace`
- [x] with `--json`, `process.stdout.write` receives a string that `JSON.parse`s to an object with `ok`, `lts` and `workspaces`, and stderr still receives the human text — `index.spec.ts::should write the JSON document to stdout and the human text to stderr with --json`
- [x] with `--json --quiet` on a passing run, stdout still receives the document and stderr receives nothing — `index.spec.ts::should still write the document and nothing to stderr with --json --quiet on a passing run`
- [x] without `--json`, nothing is written to `process.stdout` — `index.spec.ts::should write nothing to stdout without --json`

**Definition of done:**

- [x] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [x] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [x] Every acceptance criterion ticked with its evidence pointer
- [x] Change committed after both gates; hash recorded in **Commit** below
- [x] Status set to `done`; advisories (if any) noted below

**Advisories:** `index.spec.ts` `makeResult` fixtures have no `path`, so a multi-workspace `--json` test would throw in the real `buildReport` sort; the `--json` test checks `workspaces` exists, not its contents; `index.ts` calls `formatHuman(results)` normally and `formatHuman(results, { quiet: true })` only under `--quiet` (to keep an older `toHaveBeenCalledWith(results)` assertion); the package `CLAUDE.md` does not yet mention `buildReport`, `--json` or `--quiet`.

- **Log:**
  - `2026-10-08 dispatched @ sonnet (attempt 1)`
  - `2026-10-08 qoq fix PASS (knip skipped) · tests approved`
  - `2026-10-08 done`

**Commit:** 8d06ba4

### Milestone 2 — Definition of done

- [ ] All tickets above are `done`
- [ ] `qoq refactor --decisions auto <union of every ticket's Files above>` → clean. Pass the union explicitly; bare, it widens to the whole project
- [ ] Project's full build + full test suite green (the Commands header above)
- [ ] `npm run build` then `npm run check:engine` and `node packages/check-engine/bin/check-engine.js --json --no-lts` both exit 0 with valid JSON on stdout for the latter
- [ ] All results written into the summary block's **Gate evidence**
- [ ] Milestone archived: full text moved to `2026-10-08-check-engine-improvements.completed.md`, summary block left under `## Completed`
