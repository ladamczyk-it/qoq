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

### Milestone 2: Scoping, LTS advisory, discovery and machine output — delivered 2026-10-08

**Delivered:** `check-engine` accepts `--include dev,peer,optional`, discovers workspaces with `fs.globSync` (array or `{ packages }`, `**`, `!negation`, `node_modules` excluded), looks up the LTS safely (3s timeout, `./node.json` fallback, a throw that tells the user to download it or pass `--no-lts`) and reports an advisory, and emits `--json` (stdout) and `--quiet`.
**Tickets:** 2.1 Glob-based workspace discovery `45ebc52` · 2.2 `--include` dependency groups `9b17c92` · 2.3 Safe LTS fetch `bab4666` · 2.4 LTS advisory and `--no-lts` `b0ea0f3` · 2.5 `--json` and `--quiet` `8d06ba4`
**Gate evidence:** refactor `clean: JSCPD — no clone involves packages/check-engine (the remaining one is eslint-v9-js-jest-rtl vs eslint-v9-js-vitest-rtl, out of scope); design (qoq-designer) — no smells; ponytail — advisory only, not applied under --decisions auto: checkEngine.ts builds the dependency-group list with two arrays (groups + order) where one ordered filter would do (~-5 lines), index.ts:41 ternary around formatHuman(results, { quiet }) (kept for an older assertion), fetchNodeInfo.ts date sort comparator is hand-rolled (pre-existing); fixed at the gate: stale "Always [] in Milestone 1" comment in types.ts, CLAUDE.md for buildReport/--json/--quiet` · suite `npm test: 66 files, 498 tests passed, 0 failed, type errors none; full check with Knip on: 0 Knip findings; npm run build then npm run check:engine: exit 0; check-engine --json --no-lts --quiet: valid JSON, ok true, 22 workspaces, stderr empty`
**Decisions that outlive this milestone:** the LTS advisory compares majors only and never changes the exit code (whether it stays on by default is open — see Milestone 3); `fetchNodeInfo` errors propagate uncaught on purpose; `formatHuman` and `buildReport` are the only places output is shaped.
**Open advisories:** the LTS advisory fires whenever a floor's major is below the maintained LTS major, so it will fire on most published packages once consumer floors drop; `index.spec.ts` `makeResult` fixtures have no `path` (a multi-workspace `--json` test would throw in `buildReport`'s sort); `fetchNodeInfo.spec.ts` line 34 relies on test order; `!` excludes apply only to glob matches; the ponytail cuts above.
**Full detail:** [2026-10-08-check-engine-improvements.completed.md](2026-10-08-check-engine-improvements.completed.md)

---

## Milestone 3: Consumer-friendly engines for published packages

**Size:** M
**Goal:** every published package declares the lowest `engines.node` it really supports, while the private root keeps its development engines.
**Depends on:** Milestone 2 (`check-engine --json` reports each workspace's `floor`)
**Contracts:** none
**Scenarios:**

- **Given** a published package whose runtime dependencies allow Node 20.19 and up, **When** `check-engine` runs against it, **Then** its `engines.node` is the dependency-shaped range for that floor and the run passes.
- **Given** the whole repo, **When** `npm run check:engine` runs, **Then** it exits 0 and the root still passes with its development engines.

**Plan draft — NOT READY TO EXECUTE.** Decisions the user has not made yet: (1) whether the LTS advisory becomes opt-in or is dropped (it contradicts lower floors); (2) which floor policy applies — the maximum of the measured dependency floor, the floor needed by the package's own code (`check-engine` uses `fs.globSync`), and the oldest Node line that is tested and still supported by Node (Node 18 and 20 are already end-of-life); (3) whether Milestone 3 gets its own tickets per package group or one scripted sweep with a measured-floor table in the ticket Context. No tickets are written until these are answered.
