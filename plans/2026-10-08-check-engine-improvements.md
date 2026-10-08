# check-engine Improvements Implementation Plan

**Goal:** `check-engine` reports correct, attributed, readable results for every workspace in one run, and gains the flags to scope and script it.
**Architecture:** `checkEngine(path)` becomes a pure function returning a `WorkspaceResult` (no `process.exit`, no stderr writes); a pure `report.ts` renders results; `index.ts` collects every workspace, prints, and sets `process.exitCode` once. Range comparison uses `semver.subset`, which is stricter than the old `intersects` and is released as a `fix:` with the stricter behaviour called out in the commit body. Discovery moves to `node:fs` `globSync` in Milestone 2; no new dependency.
**Requirements source:** the 10-item findings list from the 2026-10-08 check-engine review, grilled with the user (all answers recorded below in Scenarios/Contracts/Context; Q4 answered "keep the throw, make the node.json instruction prominent").
**Commands:** build `npm run build` · test `npm test`
**Plan status:** in-progress

---

## Completed

### Milestone 1: Correct, attributed, readable results — delivered 2026-10-08

**Delivered:** `checkEngine` is a pure function returning attributed results (subset check, required floor, skipped/checked counts); the CLI reports every workspace on stderr, one line each, and sets `process.exitCode` once; the repo's own engines pass the stricter check.
**Tickets:** 1.1 Align every package's engines `3d006f5` · 1.2 Pure checkEngine with attribution and subset `d565a8f` · 1.3 Terse human report `fa840dc` · 1.4 Collect every workspace, exit once `2ab5fbd` · (gate) drop unconsumed types, fix spec typings `c16840b` · 1.5 Root engines track the strictest dev dependency `9d4be02` · 1.6 Report ends with a newline `697861c`
**Gate evidence:** refactor `clean: JSCPD — the only in-scope clone (index.ts:18-27 vs JscpdExecutor.ts:137-146) is pre-existing, deleted by Ticket 2.1; conventions — nothing; design (qoq-designer) — no smells; ponytail — advisory only: checkEngine.ts:20-26 floorOf try/catch is unreachable (its inputs are validRange-checked first) and checkEngine.ts:99 error-instanceof-Error fallback, net −6 lines, not applied under --decisions auto` · suite `npm test: 65 files, 462 tests passed, 0 failed, type errors none; full check with Knip on: 0 Knip findings (3 unused types found and removed at the gate); npm run build then npm run check:engine: exit 0 on all 22 workspaces`
**Decisions that outlive this milestone:** root `engines.node` is `^22.22.2` (private tooling tracks lerna's range) while published packages keep `^22.22.2 || ^24.15.0 || >=26.0.0`, both with `npm >= 10`; `IncludeFlag`/`LtsInfo` were removed from `types.ts` and are re-added by the tickets that consume them; LTS lookup is absent from the CLI until Milestone 2.
**Open advisories:** workspaceEngines.spec.ts derives expected lockfile keys from the lockfile itself; report.spec.ts table regexes assume no ANSI colour (FORCE_COLOR would break them); the ponytail floorOf/instanceof cuts above; `types.ts` carries a file-level `eslint-disable @typescript-eslint/naming-convention` for the contract names.
**Full detail:** [2026-10-08-check-engine-improvements.completed.md](2026-10-08-check-engine-improvements.completed.md)

---

## Milestone 2: Scoping, LTS advisory, discovery and machine output

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

**Commit:** PENDING

### Ticket 2.3: Safe LTS fetch

- **Status:** todo
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

- [ ] `fetch` is called with an `AbortSignal` (`expect.any(AbortSignal)`) — `<spec::>`
- [ ] a non-OK response (`ok: false`) falls back to the `path` file — `<spec::>`
- [ ] a rejected fetch falls back to the `path` file — `<spec::>`
- [ ] when fetch fails and the file read throws, the rejection message contains `https://nodejs.org/download/release/index.json`, `./node.json`, `project root` and `--no-lts` — `<spec::>`
- [ ] with a successful fetch the returned `currentLts` and `maintainedLts` are unchanged from today's behaviour for the existing fixture — `<spec::>`

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:** none

- **Log:**

**Commit:** none

### Ticket 2.4: LTS advisory and `--no-lts`

- **Status:** todo
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

**Context:** Milestone 1 removed the `fetchNodeInfo` call from `index.ts`; this ticket restores it, once per run, before the workspace map, skipped when cac's `options.lts === false` (`--no-lts`; cac defaults `options.lts` to `true`). Pass `{ include, lts }` to every `checkEngine`. `checkEngine` fills `advisories` per the **Contracts** advisory rule (`major` from `semver`). `formatHuman` prints each advisory on the workspace's line group in yellow, `⚠ <advisory>`. A thrown `fetchNodeInfo` error propagates (the instruction message is the point); do not catch it. The advisory never affects `status` or `process.exitCode`. Docs: AGENTS.md currently claims a "bundled `node.json` snapshot in the package root" — that is false (nothing ships one, `files` is `["bin","AGENTS.md"]`); replace it with: download `https://nodejs.org/download/release/index.json` to `./node.json` in the project root when offline, or use `--no-lts`. Document `--no-lts` and the advisory. CLAUDE.md: update the helper list. Milestone 1 established: `formatHuman` returns each line followed by `\n` (empty results → `''`), so advisory lines must be added as lines, not appended after the join; the CLI writes the return value to stderr verbatim. Also update `packages/check-engine/CLAUDE.md`: it still says workspace globs are expanded via `readdirSync` — Ticket 2.1 replaced that with `findWorkspaces` (`node:fs` `globSync`).

**Acceptance criteria:**

- [ ] `checkEngine(path, { include: [], lts: { currentLts: 'v24.13.0', maintainedLts: 'v22.13.1' } })` with `engines.node` `>=20.0.0` has `advisories` equal to one entry containing `20.0.0` and `v22` — `<spec::>`
- [ ] with `engines.node` `>=22.22.2` and the same `lts`, `advisories` is `[]` — `<spec::>`
- [ ] with `lts: null`, `advisories` is `[]` and `status` is unchanged — `<spec::>`
- [ ] an advisory never changes `status` (a passing workspace with an advisory is still `pass`) — `<spec::>`
- [ ] `formatHuman` renders each advisory as its own line containing the advisory text — `<spec::>`
- [ ] by default the CLI calls `fetchNodeInfo('./node.json')` exactly once for a multi-workspace run and passes the result as `lts` to every `checkEngine` call — `<spec::>`
- [ ] with `--no-lts` the CLI never calls `fetchNodeInfo` and passes `lts: null` — `<spec::>`
- [ ] when `fetchNodeInfo` rejects, the action rejects with that error and `checkEngine` is not called — `<spec::>`

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:** none

- **Log:**

**Commit:** none

### Ticket 2.5: `--json` and `--quiet`

- **Status:** todo
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

- [ ] `buildReport` returns `ok: true` when every result passes and `ok: false` when any fails — `<spec::>`
- [ ] `buildReport` sorts `workspaces` by `path` regardless of input order and carries `lts` through (`null` stays `null`) — `<spec::>`
- [ ] `formatHuman(passingResults, { quiet: true })` returns `''` even when a result has skipped malformed ranges and advisories — `<spec::>`
- [ ] `formatHuman(mixedResults, { quiet: true })` still contains the failing workspace's lines — `<spec::>`
- [ ] with `--json`, `process.stdout.write` receives a string that `JSON.parse`s to an object with `ok`, `lts` and `workspaces`, and stderr still receives the human text — `<spec::>`
- [ ] with `--json --quiet` on a passing run, stdout still receives the document and stderr receives nothing — `<spec::>`
- [ ] without `--json`, nothing is written to `process.stdout` — `<spec::>`

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS — Gate 1, run from the orchestrating thread
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED` — Gate 2
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:** none

- **Log:**

**Commit:** none

### Milestone 2 — Definition of done

- [ ] All tickets above are `done`
- [ ] `qoq refactor --decisions auto <union of every ticket's Files above>` → clean. Pass the union explicitly; bare, it widens to the whole project
- [ ] Project's full build + full test suite green (the Commands header above)
- [ ] `npm run build` then `npm run check:engine` and `node packages/check-engine/bin/check-engine.js --json --no-lts` both exit 0 with valid JSON on stdout for the latter
- [ ] All results written into the summary block's **Gate evidence**
- [ ] Milestone archived: full text moved to `2026-10-08-check-engine-improvements.completed.md`, summary block left under `## Completed`
