# QoQ MCP Pattern Server Implementation Plan

**Goal:** Serve the smell→design-pattern catalogue as a queryable read-only MCP server at `https://mcp.adamczyk.ovh`, with the seed files as the single source of truth from which the skill's shipped markdown is rendered.
**Architecture:** One Python package under `./mcp`: YAML seed records (one file per pattern) are validated by a pydantic loader, loaded into a freshly-built SQLite file with an FTS5 index, and served over streamable HTTP by a stateless FastMCP app behind nginx. The same validated records feed a generator that renders `skills/qoq/assets/patterns/**`, so the shipped markdown becomes a CI-gated projection of the seeds rather than a second source. Woodpecker builds and deploys on the box by writing into a host-mounted artifacts directory; a `systemd.path` unit restarts the service.
**Requirements source:** `/qoq plan` invocation of 2026-09-02, grilled to an empty frontier over four rounds (14 settled decisions, recorded in `docs/qoq-design.md` on delivery of Milestone 4).
**Commands:** build `npm run build` · test `npm test`
**Plan status:** draft — parked, superseded pending a Python → TypeScript replan

> **PARKED — do not execute.** This plan is written against a Python
> implementation that has been abandoned. Ticket 1.1's commit `1edeaaf` was
> reverted by `7a48d86`, so its `done` status below is false and no milestone is
> frozen. The replacement stack is settled but not yet decomposed — see
> [`2026-09-02-mcp-pattern-server.replan.md`](2026-09-02-mcp-pattern-server.replan.md)
> and resume with `/qoq replan plans/2026-09-02-mcp-pattern-server.md`.

**Scope boundary — this is plan 1 of 2.** Plan 1 owns _data and service_: the seed corpus, the database, the server, the render and its gate, and the deploy. **No agent calls the server when this plan completes.** Plan 2 owns _consumers_: `.mcp.json` in the plugin, `qoq-designer`'s frontmatter and its anti-persuasion rule, `refactor.md`'s assessment-4 fallback flow, and `cli.yaml`'s `api_version` stamp. `qoq refactor` behaves identically before and after plan 1 — the render is byte-compatible with what ships today.

---

## Milestone 1: Seed corpus

**Size:** M
**Goal:** `mcp/db/seed/patterns/**` holds all 21 patterns as validated YAML records, and a loader that names the file and the field on any bad seed. Nothing else reads them yet.
**Depends on:** none
**Contracts:**

The seed record. One file per pattern at `mcp/db/seed/patterns/<slug>.yaml` (stack `base`) or `mcp/db/seed/patterns/react/<slug>.yaml` (stack `react`). Every prose field is a YAML literal block scalar (`|`), stored verbatim, never rewrapped.

| Field             | Type                    | Required          | FTS-indexed     |
| ----------------- | ----------------------- | ----------------- | --------------- |
| `slug`            | string                  | yes               | no              |
| `stack`           | `base` \| `react`       | yes               | no              |
| `title`           | string                  | yes               | no              |
| `aliases`         | list[string]            | no (default `[]`) | yes             |
| `intro`           | markdown                | yes               | yes             |
| `smell`           | markdown                | yes               | yes             |
| `cheaper`         | markdown                | yes               | no              |
| `cost`            | markdown                | yes               | yes             |
| `wrong_call`      | markdown                | yes               | no              |
| `further_reading` | markdown                | yes               | no              |
| `examples`        | list[Example], min 1    | yes               | no              |
| `index_entries`   | list[IndexEntry], min 1 | yes               | yes (per entry) |

`Example`: `before` = `{lang: str, code: str}` (exactly one); `after` = list of `{lang: str, code: str, note: str | None}`, min 1; `note` = `str | None` (prose after the last after-block).

`IndexEntry`: `order` = int (unique within its stack), `smell` = str, `cost` = str, `cheaper` = str.

Derived, never stored: `name` = `slug` for `base`, `<stack>/<slug>` for `react`. `asset_path` = `assets/patterns/<slug>.md` or `assets/patterns/react/<slug>.md`. The shape heading is `## The TypeScript shape` for `base` and `## The React shape` for `react`.

Loader entry point: `load_seeds(root: Path) -> list[PatternRecord]`, raising `SeedError` with a message of the form `mcp/db/seed/patterns/react/provider.yaml: unknown field 'smel'` or `…: missing required field 'intro'`. Every seed is validated before any caller acts on any of them.

**Scenarios:**

- **Given** the 21 committed write-ups and the two committed index tables, **When** the one-shot port runs, **Then** `mcp/db/seed/patterns/` holds 21 YAML records carrying 22 index entries between them, with every prose field a verbatim block scalar.
- **Given** a seed file with a misspelled key or a missing required one, **When** the loader runs, **Then** it raises naming that file and that field, and no caller receives a partial record set.
- **Given** all 21 seeds, **When** the loader runs, **Then** every record's derived `name` and `asset_path` match a file that exists under `skills/qoq/assets/patterns/`.

### Ticket 1.1: Seed record schema and loader

- **Status:** done
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural,mechanical` · stack `python` · baseline 0/0
- **Escalation:** none
- **Depends on:** none
- **Needs approval:** `pyyaml` — the only genuinely new runtime dependency. There is no stdlib YAML, and JSON seeds would store prose as escaped `"line\nline"` strings, destroying the git-diff-as-change-record property that file-per-record exists for. Used load-only (`yaml.safe_load`); nothing in this plan ever calls `yaml.dump`.
- **Files:**
  - Create: `mcp/pyproject.toml`
  - Create: `mcp/src/qoq_mcp/__init__.py`
  - Create: `mcp/src/qoq_mcp/seeds.py`
  - Create: `mcp/tests/test_seeds.py`
  - Modify: `.gitignore`
  - Modify: `.prettierignore`
  - Create: `mcp/uv.lock` — added at execution. Generated by `uv sync`; the user approved committing it. The `.prettierignore` line this ticket adds only means something if the file is tracked.

**Context:** This is the first Python code in a JS/TS Lerna monorepo. `mcp/` is deliberately **not** an npm workspace — `package.json`'s `workspaces` is `["packages/*"]` and stays that way; Lerna does not build it and semantic-release does not version it. The Python tree is self-contained and managed by `uv`.

`pyproject.toml` declares the package `qoq-mcp` with dependencies `mcp` and `pyyaml`, and dev dependencies `ruff` and `pytest`. Note that the `mcp` SDK already brings `pydantic>=2.12` and `uvicorn` transitively, so the seed models are pydantic models and neither is a new dependency to approve.

`__init__.py` holds `API_VERSION = "6.1.5"` as a module-level literal string — nothing else. It is stamped at release by `scripts/sync-plugin-version.js` (wired in Milestone 4), which is why it must be a plain assignment matchable by a regex, on its own line, and why the file must contain no other logic. The server reads its version from this literal and never from the filesystem or `importlib.metadata`, because the deployed service is bound by a hard rule: **no state outside `patterns.db`, no writes, no filesystem access beyond that one file.** That rule is what keeps a later move to serverless a config change.

`seeds.py` defines the pydantic models for the contract above and `load_seeds(root)`. Two details the contract does not spell out:

- Validation must produce the file path and the field name. Pydantic's `ValidationError` carries the field location but not the file; catch it per file and re-raise as `SeedError` with the path prefixed. Set `model_config = ConfigDict(extra="forbid")` so an unknown key is an error rather than a silently dropped field.
- All files are read and validated before the function returns anything. A caller must never receive a half-loaded corpus.

`.gitignore` gains `mcp/.venv/`, `**/__pycache__/`, `*.egg-info/`. Note that the existing `**/build` and `**/lib` entries already ignore anything under a directory of those names — do not name a Python package directory `lib/`, or it will silently not be committed.

`.prettierignore` gains `mcp/uv.lock`. Prettier's `sources` in `qoq.config.js` is `['.']`, so it walks `./mcp`; the seed YAML is deliberately left in Prettier's hands (that is settled), but the lockfile is not ours to format.

Tests use `pytest`, not vitest — `vitest.config.js` sets `projects: ['packages/*']` and will never see `mcp/`. This mirrors the existing split documented in CLAUDE.md, where `skills/qoq/scripts/*.spec.mjs` are `node:test` rather than vitest.

**Acceptance criteria:**

- [x] `load_seeds` on a directory containing a YAML file with an unknown key raises `SeedError` whose message contains both that file's path and the unknown key's name — `mcp/tests/test_seeds.py::test_load_seeds_unknown_key_raises_seed_error_with_path_and_field`
- [x] `load_seeds` on a directory containing a YAML file missing a required key raises `SeedError` whose message contains both that file's path and the missing key's name — `mcp/tests/test_seeds.py::test_load_seeds_missing_key_raises_seed_error_with_path_and_field`
- [x] A record with `stack: base` and `slug: strategy` exposes `name == "strategy"` and `asset_path == "assets/patterns/strategy.md"` — `mcp/tests/test_seeds.py::test_base_record_derives_name_and_asset_path`
- [x] A record with `stack: react` and `slug: provider` exposes `name == "react/provider"` and `asset_path == "assets/patterns/react/provider.md"` — `mcp/tests/test_seeds.py::test_react_record_derives_name_and_asset_path`
- [x] A record whose `examples` list is empty fails validation — `mcp/tests/test_seeds.py::test_record_with_empty_examples_fails_validation`
- [x] A record whose `index_entries` list is empty fails validation — `mcp/tests/test_seeds.py::test_record_with_empty_index_entries_fails_validation`
- [x] An `Example` whose `after` list is empty fails validation — `mcp/tests/test_seeds.py::test_example_with_empty_after_fails_validation`
- [x] `load_seeds` raises before returning when any one file in the directory is invalid, even if others are valid — `mcp/tests/test_seeds.py::test_load_seeds_raises_before_returning_when_one_file_invalid`

**Definition of done:**

- [x] `qoq fix <files above>` → PASS
- [x] `qoq-test-reviewer` over the spec files → `APPROVED`
- [x] Every acceptance criterion ticked with its evidence pointer
- [x] Change committed after both gates; hash recorded in **Commit** below
- [x] Status set to `done`; advisories (if any) noted below

**Advisories:**

- `uv` was not installed on this machine; the developer bootstrapped it into `~/.local/bin`. **Milestone 5's CI tickets must put `uv` on `PATH` explicitly** — check ticket 5.1 covers it, and raise a ticket if it does not.
- Running `pytest` leaves `mcp/.pytest_cache/`, which Prettier walks and reports on every subsequent run. The ticket's `.gitignore` list covered `__pycache__` but not this. `.pytest_cache/` added to both `.gitignore` and `.prettierignore` — both already on the Files list, so the fix stayed inside the ticket.
- Gate 2 noted no criterion covers `IndexEntry.order` uniqueness within a stack, which the Milestone 1 contract states. Not a defect in these specs — a plan-scope gap. **Ticket 2.1 or 1.2 should pin it**, or it goes unenforced.
- Added spec beyond the criteria: `test_load_seeds_loads_valid_base_and_react_files`, covering `load_seeds`'s success path and recursive `react/` discovery. Gate 2 approved it as legitimate.

- **Log:**
  - dispatched to `qoq-developer` at `sonnet`, attempt 1 — branch `plan/mcp-pattern-server`; `pyyaml` approved by the user at run start
  - handed back 6 files + `mcp/uv.lock`; 8 criteria proved red in one run, then green; 1 spec added after green
  - Gate 1 `qoq fix` scoped → **PASS**, 0 findings in scope
  - Gate 2 `qoq-test-reviewer` → **APPROVED**, full criterion → assertion mapping returned
  - committed `1edeaaf`; status `done` in 1 attempt

**Commit:** `1edeaaf`

### Ticket 1.2: One-shot port of the 21 write-ups into seed records

- **Status:** todo
- **Size:** M
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural,mechanical` · stack `python` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 1.1
- **Files:**
  - Create: `mcp/tools/port_writeups.py`
  - Create: `mcp/db/seed/patterns/adapter.yaml`
  - Create: `mcp/db/seed/patterns/builder.yaml`
  - Create: `mcp/db/seed/patterns/chain-of-responsibility.yaml`
  - Create: `mcp/db/seed/patterns/command.yaml`
  - Create: `mcp/db/seed/patterns/composite.yaml`
  - Create: `mcp/db/seed/patterns/decorator.yaml`
  - Create: `mcp/db/seed/patterns/facade.yaml`
  - Create: `mcp/db/seed/patterns/factory.yaml`
  - Create: `mcp/db/seed/patterns/observer.yaml`
  - Create: `mcp/db/seed/patterns/state.yaml`
  - Create: `mcp/db/seed/patterns/strategy.yaml`
  - Create: `mcp/db/seed/patterns/template-method.yaml`
  - Create: `mcp/db/seed/patterns/react/compound-components.yaml`
  - Create: `mcp/db/seed/patterns/react/container-presentational.yaml`
  - Create: `mcp/db/seed/patterns/react/control-props.yaml`
  - Create: `mcp/db/seed/patterns/react/custom-hook.yaml`
  - Create: `mcp/db/seed/patterns/react/error-boundary.yaml`
  - Create: `mcp/db/seed/patterns/react/headless.yaml`
  - Create: `mcp/db/seed/patterns/react/portal.yaml`
  - Create: `mcp/db/seed/patterns/react/props-getters.yaml`
  - Create: `mcp/db/seed/patterns/react/provider.yaml`
  - Create: `mcp/tests/test_port_roundtrip.py`

**Context:** A throwaway script, run once, reviewed as a diff, and deleted in the same commit that lands the YAML it produced. It is not a maintained tool — the seed files are the source the moment it has run, and all later content changes are PRs against the YAML. Mark it with a `ponytail:` comment saying exactly that.

The 21 write-ups under `skills/qoq/assets/patterns/` share a perfectly rigid skeleton, verified across every file:

```
# <title>
<intro>
## The smell it answers
## The cheaper thing first
## The <TypeScript|React> shape
### Before
### After
## What it costs
## When it's the wrong call
## Further reading
```

`TypeScript` for the 12 base files, `React` for the 9 under `react/`. What varies, and what the parser must therefore handle:

- `### Before` is always exactly one fenced block with nothing after it.
- `### After` holds **one or two** fenced blocks, sometimes with prose between them and/or after the last one. Two blocks appear in `state.md`, `decorator.md`, `template-method.md`, `container-presentational.md`, `portal.md`, `compound-components.md`, `error-boundary.md`, `props-getters.md`, `custom-hook.md`, `headless.md`. Prose between blocks becomes that block's `note`; prose after the last block becomes the example's `note`, which is absent in `facade.md`, `decorator.md` and `template-method.md`.
- Fence languages vary **within one file** — `react/props-getters.md` uses `tsx` for before and both `ts` and `tsx` after; `react/portal.md:24` is `html`. `lang` is stored per block and never derived from `stack`.
- `## The cheaper thing first` holds zero, one or two fences (zero in `react/error-boundary.md`, two in `react/compound-components.md`), and `## The smell it answers` can hold one (`react/control-props.md:13`). These sections are captured as **opaque verbatim markdown** — only the Before/After blocks get structure. Sub-structuring anything else is how the byte-identical gate in Milestone 4 dies.

Index entries come from the two tables. `skills/qoq/assets/patterns/index.md`'s "The smells worth hunting" table has **22 rows for 21 patterns**: `index.md:33` and `index.md:35` both link `strategy.md` (divergent switch, and boolean/mode parameters). Strategy's record therefore carries two `index_entries` and every other carries one. `react/index.md`'s table supplies the react records' entries.

Row order is **editorial** — base runs Strategy, Factory, Strategy, Adapter, Decorator…, which is neither alphabetical nor derivable from anything. Capture the committed position as the `order` integer, unique within each stack, or Milestone 4's generated table is a 22-line diff on day one.

Two hard rules on emitting the YAML:

1. **Never call `yaml.dump`.** It folds at width 80 and silently converts a `|` block scalar to a quoted string when the value has trailing whitespace or no final newline. Emit block scalars by direct string construction. Every line break in all 21 files is hand-authored — `packages/prettier/src/config.js` sets no `proseWrap`, so it defaults to `preserve` and Prettier will not restore a break that gets normalised away. The worst concrete case is `skills/qoq/assets/patterns/react/control-props.md:31-32`, an inline code span split across a hand-wrapped line break; any normaliser "fixes" it and the gate goes permanently red.
2. **Use `|` (clip) uniformly** for every prose field, and let Milestone 4's renderer own the separators between sections. `|-` and `|+` change the trailing newline count per field, and getting `further_reading` wrong once makes all 21 rendered files differ by a blank line.

Code inside the fences is already Prettier-formatted — `embeddedLanguageFormatting` defaults to `auto`, which is why `composite.md:22-23` and `:60-61` carry that oddly-split union. Extracting verbatim from the committed files preserves that for free.

**Acceptance criteria:**

- [ ] `load_seeds` over `mcp/db/seed/patterns/` returns exactly 21 records
- [ ] Those 21 records carry exactly 22 `index_entries` between them
- [ ] The record with `slug: strategy` carries exactly 2 `index_entries`, and every other record carries exactly 1
- [ ] Exactly 12 records have `stack: base` and exactly 9 have `stack: react`
- [ ] Every record's derived `asset_path` names a file that exists under `skills/qoq/assets/patterns/`
- [ ] The `react/props-getters` record has an example whose `before.lang` is `tsx` and whose `after` blocks include a block with `lang == "ts"` and a block with `lang == "tsx"`
- [ ] The `react/portal` record has an example with a block whose `lang == "html"`
- [ ] Each of `facade`, `decorator`, `template-method` has `examples[0].note is None`
- [ ] Each of `state`, `decorator`, `template-method`, `react/portal`, `react/headless` has an example whose `after` list has length 2
- [ ] Across all records, the `order` values within each stack are unique and contiguous from 1
- [ ] Re-reading every seed file as raw text, no prose field's stored value differs from the corresponding section of its source markdown by any character

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Milestone 1 — Definition of done

- [ ] All tickets above are `done`
- [ ] `qoq refactor --decisions auto mcp/` → clean
- [ ] Project's full build + full test suite green (`npm run build`, `npm test`), plus `pytest` under `mcp/`
- [ ] Both results written into the summary block's **Gate evidence**
- [ ] Milestone archived: full text moved to `2026-09-02-mcp-pattern-server.completed.md`, summary block left under `## Completed`, downstream tickets' **Context** updated with anything this milestone actually established

---

## Milestone 2: The database build

**Size:** S
**Goal:** `npm run mcp:build` turns the seed corpus into a `patterns.db` carrying an FTS5 index, from a fresh file every time, and writes nothing at all when a seed is bad.
**Depends on:** Milestone 1
**Contracts:**

`mcp/db/structure/0001_initial.sql`:

```sql
CREATE TABLE patterns (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,   -- 'strategy' | 'react/provider'
  slug            TEXT NOT NULL,
  stack           TEXT NOT NULL,          -- 'base' | 'react'
  pattern_name    TEXT NOT NULL,          -- the title
  asset_path      TEXT NOT NULL UNIQUE,
  intro           TEXT NOT NULL,
  smell           TEXT NOT NULL,
  cheaper         TEXT NOT NULL,
  cost            TEXT NOT NULL,
  wrong_call      TEXT NOT NULL,
  further_reading TEXT NOT NULL,
  aliases         TEXT NOT NULL DEFAULT '',
  examples        TEXT NOT NULL           -- JSON array, served verbatim
);

CREATE TABLE index_entries (
  id         INTEGER PRIMARY KEY,
  pattern_id INTEGER NOT NULL REFERENCES patterns(id),
  stack      TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  smell      TEXT NOT NULL,
  cost       TEXT NOT NULL,
  cheaper    TEXT NOT NULL,
  UNIQUE (stack, sort_order)
);

CREATE VIRTUAL TABLE search USING fts5(
  entry_id UNINDEXED,
  entry_smell, entry_cost, intro, smell, cost, aliases,
  tokenize = 'porter unicode61'
);
```

Build entry point: `build(seed_root: Path, structure_root: Path, out: Path) -> None`. Migration order is `sorted(glob('*.sql'))`. There is no `schema_migrations` ledger: nothing is ever applied to an existing database, so a ledger would record a fact no code reads.

One `search` row per **index entry** — 22 rows — carrying that entry's own smell and cost plus its pattern's `intro`, `smell`, `cost` and `aliases`. That is what lets `bm25()` rank entries directly, so `lookup_pattern` is one query with no post-sort. No triggers and no external-content `rebuild`: the database is built fresh and is read-only at runtime, so there is nothing to keep in sync.

**Scenarios:**

- **Given** a checkout with no `patterns.db`, **When** the build runs, **Then** a `patterns.db` exists holding 21 patterns, 22 index entries and 22 searchable rows.
- **Given** one seed file that fails validation, **When** the build runs, **Then** it exits non-zero naming that file, and no `patterns.db` is created or replaced.
- **Given** a second migration file added to `db/structure/`, **When** the build runs, **Then** migrations apply in filename order and the resulting schema reflects the last one.

### Ticket 2.1: Initial migration and the migration runner

- **Status:** todo
- **Size:** XS
- **Complexity:** mechanical
- **Agent tier:** `haiku`
- **Estimate:** `mechanical` · stack `python` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 1.1
- **Files:**
  - Create: `mcp/db/structure/0001_initial.sql`
  - Create: `mcp/src/qoq_mcp/migrate.py`
  - Create: `mcp/tests/test_migrate.py`

**Context:** `apply_migrations(conn, structure_root)` reads every `*.sql` under `structure_root`, sorts by filename, and executes each against the connection with `executescript`. The database it is handed is always brand new and empty — the build creates a fresh file every run — so there is no ledger, no "already applied" check, and no down-migrations.

The schema itself is fixed by the milestone's **Contracts** above; transcribe it. Two points that are load-bearing and easy to lose: `examples` stays a single JSON text column because it is served verbatim and never queried — shredding it into three tables buys a join and nothing else — and `search` is a plain FTS5 table, not `content=` external-content, because there is no base table to stay in sync with at runtime.

Sequential migration files are deliberate even though the database is rebuilt from scratch every build: schema evolution is reviewable as a diff, and `0002_*.sql` is where a later field lands.

**Acceptance criteria:**

- [ ] `apply_migrations` against an in-memory connection creates tables named `patterns`, `index_entries` and `search`
- [ ] Given a structure directory holding `0002_b.sql` and `0001_a.sql`, `apply_migrations` executes `0001_a.sql` before `0002_b.sql`
- [ ] After `apply_migrations`, inserting two `index_entries` rows with the same `(stack, sort_order)` raises an integrity error
- [ ] After `apply_migrations`, inserting two `patterns` rows with the same `name` raises an integrity error
- [ ] After `apply_migrations`, a `search` row can be inserted and retrieved with a `MATCH` query

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Ticket 2.2: The build script

- **Status:** todo
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural,mechanical` · stack `python` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 2.1
- **Files:**
  - Create: `mcp/src/qoq_mcp/build.py`
  - Create: `mcp/tests/test_build.py`
  - Modify: `package.json`

**Context:** `build(seed_root, structure_root, out)` does four things in this order: call `load_seeds` (which raises on any bad seed before returning anything), create a fresh SQLite file at `out.with_suffix('.tmp')`, apply the migrations, bulk-insert the records, and only then `os.replace` the temp file over `out`.

The `os.replace` at the end is the whole reason for the temp file, and it satisfies two separate requirements: a failed build leaves the previous `patterns.db` untouched rather than half-written, and the deployed service — which opens the file by path per request — picks up a swapped file with no restart.

Per record: one `patterns` row (with `examples` serialised as JSON and `aliases` newline-joined), one `index_entries` row per entry, and one `search` row per entry carrying that entry's `smell` and `cost` plus the pattern's `intro`, `smell`, `cost` and `aliases`.

Add `"mcp:build": "uv run --project mcp python -m qoq_mcp.build"` to `package.json`'s scripts. Do not add `mcp/` to `workspaces` — it is a Python tree and Lerna has nothing to do with it.

The build output goes to `mcp/build/patterns.db`. `.gitignore` already carries `**/build`, so it is ignored without a new entry — but confirm that, rather than assuming it.

**Acceptance criteria:**

- [ ] Running `build` against the committed seed corpus produces a file containing exactly 21 rows in `patterns`
- [ ] That file contains exactly 22 rows in `index_entries` and exactly 22 rows in `search`
- [ ] Every `search` row's `entry_id` matches an existing `index_entries.id`
- [ ] The `patterns` row for `strategy` has an `examples` column that parses as JSON to a list of length 1
- [ ] A `MATCH` query for `switch` against `search` returns at least one row whose `entry_id` belongs to the `strategy` pattern
- [ ] Given a seed directory containing one invalid file, `build` raises and no file exists at the output path
- [ ] Given an output path where a valid `patterns.db` already exists, and a seed directory containing one invalid file, `build` raises and the existing file's contents are unchanged
- [ ] Running `build` twice in a row produces a file with the same row counts both times

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Milestone 2 — Definition of done

- [ ] All tickets above are `done`
- [ ] `qoq refactor --decisions auto mcp/ package.json` → clean
- [ ] Project's full build + full test suite green (`npm run build`, `npm test`), plus `pytest` under `mcp/`
- [ ] Both results written into the summary block's **Gate evidence**
- [ ] Milestone archived; summary block left under `## Completed`

---

## Milestone 3: The MCP server

**Size:** M
**Goal:** A stateless FastMCP app over streamable HTTP exposing `lookup_pattern` and `get_pattern`, every response carrying the version envelope, reading a swappable read-only database.
**Depends on:** Milestone 2
**Contracts:**

Every response, success or not-found, carries at top level:

```json
{ "api_version": "6.1.5", "api_major": 6 }
```

`api_major` is an integer, comparable with `!=`, needing no semver parsing. `api_version` is the npm workspace version — the whole toolkit moves in lockstep, so a breaking change to these two tool schemas can only be expressed as a major release of `@ladamczyk/qoq`. Both are read from `qoq_mcp.API_VERSION`, a module literal; the server touches no file but `patterns.db`.

`lookup_pattern(smell_description: str, limit: int = 5)`:

```json
{
  "api_version": "6.1.5",
  "api_major": 6,
  "results": [
    {
      "name": "strategy",
      "pattern_name": "Strategy",
      "stack": "base",
      "smell": "**Divergent switch** — same `switch`/if-chain on a type tag in several places",
      "cost": "one new case means finding every copy; they drift",
      "cheaper": "`Record<Tag, handler>` in one module",
      "asset_path": "assets/patterns/strategy.md",
      "score": 8.41
    }
  ]
}
```

Rows are **index entries**, not patterns: `name`, `pattern_name` and `asset_path` may repeat across rows in one result set, because Strategy owns two entries and a caller must see the entry that actually matched. `score` is `-bm25(search)` — positive, higher is better, no meaning across queries. No body field ever. An empty `results` list is a valid answer, not an error.

`get_pattern(name: str)` — `name` is the stack-prefixed slug (`strategy`, `react/provider`):

```json
{
  "api_version": "6.1.5",
  "api_major": 6,
  "found": true,
  "pattern": {
    "name": "react/provider",
    "pattern_name": "Provider",
    "stack": "react",
    "asset_path": "assets/patterns/react/provider.md",
    "intro": "…",
    "smell": "…",
    "cheaper": "…",
    "cost": "…",
    "wrong_call": "…",
    "further_reading": "…",
    "aliases": [],
    "examples": [
      {
        "before": { "lang": "tsx", "code": "…" },
        "after": [{ "lang": "tsx", "code": "…", "note": null }],
        "note": "…"
      }
    ],
    "index_entries": [{ "smell": "…", "cost": "…", "cheaper": "…" }]
  }
}
```

Not found is a **result, not an MCP error**:

```json
{
  "api_version": "6.1.5",
  "api_major": 6,
  "found": false,
  "requested": "react/providers",
  "closest": [
    {
      "name": "react/provider",
      "pattern_name": "Provider",
      "asset_path": "assets/patterns/react/provider.md"
    }
  ]
}
```

**Scenarios:**

- **Given** the server running against a built database, **When** a caller sends `lookup_pattern("the same switch on a type tag appears in four modules")`, **Then** Strategy's divergent-switch entry comes back ranked above less relevant rows, carrying its smell, cost, cheaper alternative, slug and asset path, and no body.
- **Given** a free-text description containing words that are FTS5 query syntax, **When** `lookup_pattern` runs, **Then** it returns results rather than raising.
- **Given** a caller built against an older major, **When** it reads any response from either tool, **Then** it detects the incompatibility from one integer field without parsing a version string.
- **Given** `get_pattern("react/provider")`, **Then** the full record comes back including every example; **given** a name that does not exist, **Then** a not-found result naming the closest matches, not an error.
- **Given** `patterns.db` is replaced by an atomic `os.replace` while the server is running, **When** the next request arrives, **Then** it reads the new file with no restart.

### Ticket 3.1: Server skeleton, version envelope, and database access

- **Status:** todo
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural` · stack `python` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 2.2
- **Files:**
  - Create: `mcp/src/qoq_mcp/server.py`
  - Create: `mcp/src/qoq_mcp/db.py`
  - Create: `mcp/tests/test_db.py`
  - Create: `mcp/tests/test_envelope.py`

**Context:** `server.py` builds `FastMCP("qoq-patterns", stateless_http=True)` and exposes `app = mcp.streamable_http_app()` as an ASGI application, which Milestone 5 runs under `uvicorn`. `stateless_http=True` is deliberate: a read-only lookup surface has no session state, and statelessness is what makes the "move to serverless is a config change" rule true rather than aspirational.

`db.py` owns two things. First, `envelope(**fields)` returning a dict that always starts with `api_version` (from `qoq_mcp.API_VERSION`) and `api_major` (its major component as an `int`), merged with the caller's fields — so no tool can forget it. Second, `connect()`:

```python
sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
```

opened **fresh per request, by path**. Two things about this are non-negotiable and both are easy to get wrong:

- `mode=ro`, **never `immutable=1`**. `immutable` is the obvious performance flag for a read-only SQLite file and it caches aggressively, which defeats the atomic-swap scenario entirely — the process would keep serving the old data forever.
- Opening **by path**, not holding a long-lived connection. A held connection keeps the old inode alive after `os.replace`; opening by path is what picks up the new file.

`DB_PATH` comes from an environment variable with a sensible default, because Milestone 5 deploys the database to a different path than the build writes it to. That variable is the _only_ configuration this service has, which is the point of the no-state rule.

**Acceptance criteria:**

- [ ] `envelope()` returns a dict whose `api_version` equals `qoq_mcp.API_VERSION`
- [ ] `envelope()` returns a dict whose `api_major` is an `int` equal to the integer before the first dot of `API_VERSION`
- [ ] `envelope(found=True)` returns a dict containing `api_version`, `api_major` and `found`
- [ ] A connection returned by `connect()` raises on an attempted `INSERT`
- [ ] Given a database file, a first `connect()` and read, then `os.replace` of a different database over that path, a second `connect()` reads the replaced file's contents
- [ ] `connect()` honours the `DB_PATH` environment variable when set

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Ticket 3.2: `lookup_pattern`

- **Status:** todo
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural` · stack `python` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 3.1
- **Files:**
  - Modify: `mcp/src/qoq_mcp/server.py`
  - Create: `mcp/src/qoq_mcp/lookup.py`
  - Create: `mcp/tests/test_lookup.py`

**Context:** A `@mcp.tool()` function taking `smell_description: str` and `limit: int = 5`, returning the payload in the milestone's **Contracts**.

The single thing most likely to be got wrong: **`smell_description` must never reach `MATCH` raw.** It is free prose, and `AND`, `OR`, `NOT`, `NEAR`, `"`, `*`, `:`, `-` and `(` are all FTS5 query syntax. A sentence containing any of them raises `sqlite3.OperationalError` — not a bad ranking, a crash. Sanitise with `re.findall(r"\w+", text.lower())`, drop tokens shorter than three characters, and join the rest with `" OR "`. An input that leaves no tokens returns an empty `results` list rather than querying.

This is worth stating because the scenario's own example sentence happens to contain no syntax characters, so a test written from the scenario alone passes while the first real caller who writes "loading or error" gets a stack trace. Cover it explicitly.

The query joins `search` to `index_entries` to `patterns`, orders by `bm25(search)` ascending, and returns `-bm25(search)` as `score` so higher is better. One query, no post-sort — the FTS rows are already per-entry.

Rows are index entries. Strategy owns two, so a query matching both returns two rows with the same `name`, `pattern_name` and `asset_path`. That is correct and deliberate: collapsing them would show the caller a smell string that is not the one their query matched.

**Acceptance criteria:**

- [ ] `lookup_pattern("the same switch on a type tag appears in four modules")` returns results whose first row has `name == "strategy"`
- [ ] Every row returned by `lookup_pattern` has exactly the keys `name`, `pattern_name`, `stack`, `smell`, `cost`, `cheaper`, `asset_path`, `score`
- [ ] No row returned by `lookup_pattern` contains any of the keys `intro`, `examples`, `wrong_call`, `further_reading`
- [ ] `lookup_pattern("loading or error state")` returns without raising
- [ ] `lookup_pattern('a "quoted" NEAR* thing (here)')` returns without raising
- [ ] `lookup_pattern("zzzz")` returns a response whose `results` is an empty list and whose `api_major` is present
- [ ] `lookup_pattern("a")` returns a response whose `results` is an empty list
- [ ] `lookup_pattern(<query matching both Strategy entries>)` returns two rows with `name == "strategy"` and different `smell` values
- [ ] Every row's `score` is greater than zero, and rows are ordered by descending `score`
- [ ] `lookup_pattern("switch", limit=2)` returns at most 2 rows

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Ticket 3.3: `get_pattern`

- **Status:** todo
- **Size:** XS
- **Complexity:** mechanical
- **Agent tier:** `haiku`
- **Estimate:** `mechanical` · stack `python` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 3.1
- **Files:**
  - Modify: `mcp/src/qoq_mcp/server.py`
  - Create: `mcp/src/qoq_mcp/fetch.py`
  - Create: `mcp/tests/test_fetch.py`

**Context:** A `@mcp.tool()` function taking `name: str` — the stack-prefixed slug, `strategy` or `react/provider` — and returning the payload in the milestone's **Contracts**.

On a hit: one row from `patterns` by `name`, with `examples` parsed back from its JSON column, `aliases` split on newlines into a list (an empty stored value yields `[]`, not `[""]`), and the pattern's `index_entries` rows attached in `sort_order`.

On a miss: `found: false`, never an MCP error and never a raised exception. `closest` comes from `difflib.get_close_matches(name, all_names)` — stdlib, 21 candidates, no index and no dependency needed. A miss with no close matches returns an empty `closest` list, which is still a valid response.

**Acceptance criteria:**

- [ ] `get_pattern("react/provider")` returns a response with `found` true whose `pattern.name` is `react/provider`
- [ ] That response's `pattern.examples` is a list whose first item has `before` and `after` keys, with `after` a non-empty list
- [ ] That response's `pattern.aliases` is a list
- [ ] `get_pattern("strategy")` returns a response whose `pattern.index_entries` has length 2
- [ ] `get_pattern("react/providers")` returns a response with `found` false, `requested` equal to `react/providers`, and `closest` containing an entry with `name` `react/provider`
- [ ] `get_pattern("qqqqqqqq")` returns a response with `found` false and `closest` an empty list, without raising
- [ ] Every response from `get_pattern`, hit or miss, carries `api_version` and `api_major`
- [ ] `get_pattern("provider")` — the bare slug of a react pattern — returns `found` false

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Milestone 3 — Definition of done

- [ ] All tickets above are `done`
- [ ] `qoq refactor --decisions auto mcp/` → clean
- [ ] Project's full build + full test suite green (`npm run build`, `npm test`), plus `pytest` under `mcp/`
- [ ] Both results written into the summary block's **Gate evidence**
- [ ] Milestone archived; summary block left under `## Completed`

---

## Milestone 4: The render and its gate

**Size:** M
**Goal:** `skills/qoq/assets/patterns/**` becomes a byte-identical render of the seed corpus, with drift caught as a failing check on every push, and the docs saying so.
**Depends on:** Milestone 1
**Contracts:**

Generator entry point: `render(seed_root: Path, template_root: Path, out_root: Path) -> None`.

**Input**: the same validated records `load_seeds` returns — one loader, two consumers — plus `mcp/render/templates/index.md` and `mcp/render/templates/react/index.md`. Each template is that index file's committed prose verbatim (`Stacks`, `The other ten GoF patterns` / `The other twelve from the catalogue`, `What the caller does with a finding`) with one line holding the literal token `{{SMELLS_TABLE}}`. A token rather than an HTML comment, because the marker must not survive into the output.

**Output**: exactly 23 files, all of them, every run, never a delete — 12 at `skills/qoq/assets/patterns/<slug>.md`, 9 at `skills/qoq/assets/patterns/react/<slug>.md`, plus both `index.md` files.

**Pure**: output is a function of seeds and templates only. No timestamps, no directory-listing order, no locale. Files iterated sorted by `name`; table rows by `index_entries[].order`.

Per write-up, in order: `# {title}`, blank, `intro`, `## The smell it answers` + `smell`, `## The cheaper thing first` + `cheaper`, `## The {TypeScript|React} shape`, `### Before` + the one before-fence, `### After` + each after-block (fence, then its `note` where present), then `examples[0].note` where present, `## What it costs` + `cost`, `## When it's the wrong call` + `wrong_call`, `## Further reading` + `further_reading`. Exactly one blank line between blocks; exactly one trailing newline at EOF.

**Only `examples[0]` is rendered.** A record's second and later examples are served by `get_pattern` and never appear in the markdown. This is the settled resolution of the conflict between a list-valued field and a byte-identical gate: the shipped file stays exactly the floor, and the extra examples become the concrete thing the server has that the file does not.

Index table: header `| Smell | Costs you | Cheaper first | Pattern |`, Pattern cell `[{title}]({slug}.md)` — a bare basename, since base rows link within `assets/patterns/` and react rows within `assets/patterns/react/`. Cells padded `"| " + cell.ljust(W) + " |"` with `W` the maximum `len()` in that column.

Gate, run by `husky:pre-push` and by Woodpecker:

```
render  →  npx prettier --write 'skills/qoq/assets/patterns/**/*.md'  →  git diff --exit-code -- skills/qoq/assets/patterns
```

**Scenarios:**

- **Given** the committed seed corpus, **When** the generator runs on a clean checkout, **Then** all 21 write-ups and both index files are byte-identical to what git already holds.
- **Given** a seed file changed without regenerating, **When** the gate runs, **Then** it fails and names the files that drifted.
- **Given** a record carrying two examples, **When** the generator runs, **Then** the rendered file shows only the first and is otherwise unchanged.
- **Given** someone reading `CLAUDE.md`, **Then** `assets/patterns/` is documented as generated, with `mcp/db/seed/patterns/` named as its source and a never-edit-by-hand rule.

### Ticket 4.1: Write-up renderer

- **Status:** todo
- **Size:** S
- **Complexity:** judgment-heavy
- **Agent tier:** `claude-opus-5`
- **Estimate:** `architectural,pattern-repeat` · stack `python` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 1.2
- **Files:**
  - Create: `mcp/src/qoq_mcp/render.py`
  - Create: `mcp/tests/test_render_writeups.py`

**Context:** Renders one `PatternRecord` to the exact bytes of its committed markdown file, for all 21. The section order and separator rules are in the milestone's **Contracts**; the rest of this is what makes hitting them actually possible.

The shape heading is derived from `stack` — `## The TypeScript shape` for `base`, `## The React shape` for `react` — never stored, because it is perfectly correlated across all 21 files.

Three things that will otherwise cost attempts:

1. **Trailing newlines.** Every prose field is stored as a `|` (clip) block scalar, which means each ends with exactly one newline. The renderer owns every separator between sections; do not add a field's own trailing newline to a separator and get two.
2. **`examples[0]` only.** Later examples are not rendered at all. A record with three examples renders identically to the same record with one.
3. **Prettier runs after this.** The gate pipes the output through `prettier --write` before diffing, so this renderer does not have to be a Prettier reimplementation — it has to be close, and Prettier settles the bytes. Do not attempt to reproduce Prettier's exact code formatting inside fences; the stored code is already embedded-formatted because it was extracted from files Prettier had already processed.

One consequence worth knowing about: `embeddedLanguageFormatting` defaults to `auto`, so a stored snippet that does not parse as its declared `lang` makes Prettier throw on the whole generated file, and the error names the generated file rather than the seed that caused it. Where the renderer can cheaply attach the source record's path to such a failure, do.

**Acceptance criteria:**

- [ ] For each of the 21 records, the rendered string equals the current contents of the file at its `asset_path`, byte for byte
- [ ] A `base` record renders a line `## The TypeScript shape` and no line `## The React shape`
- [ ] A `react` record renders a line `## The React shape` and no line `## The TypeScript shape`
- [ ] A record whose `examples` list has two items renders identically to the same record with only the first item
- [ ] A rendered write-up ends with exactly one newline character
- [ ] A record whose `examples[0].after` has two blocks renders two fenced blocks under `### After`
- [ ] A record whose `examples[0].after[0].note` is set renders that prose between the first and second fenced blocks
- [ ] A record whose `examples[0].note` is `None` renders no prose between the last after-block and `## What it costs`

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Ticket 4.2: Index renderer and templates

- **Status:** todo
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural` · stack `python` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 4.1
- **Files:**
  - Create: `mcp/render/templates/index.md`
  - Create: `mcp/render/templates/react/index.md`
  - Modify: `mcp/src/qoq_mcp/render.py`
  - Create: `mcp/tests/test_render_index.py`

**Context:** The two templates are the committed `index.md` and `react/index.md` with their "smells worth hunting" table replaced by a line containing only `{{SMELLS_TABLE}}`. Everything else in those files — `Stacks`, `The other ten GoF patterns` / `The other twelve from the catalogue`, `What the caller does with a finding` — is hand-written prose that belongs to no record and is carried verbatim.

Table rows come from every record's `index_entries` for that stack, ordered by `order`. Base has 12 patterns but **22 rows across both tables**: `strategy` owns two entries in the base table (`index.md:33` and `index.md:35` in the current file), so the base table has 13 rows.

Column padding is `"| " + cell.ljust(W) + " |"` where `W` is the maximum `len()` in that column. This has been measured against the committed file and matches: `index.md:32`'s first separator cell is exactly 83 dashes, and 83 is the plain `len()` of the longest cell — `**Recursive special-casing** — leaf and container handled separately at every level`. Prettier is counting the em-dash as width 1 there, so a naive `ljust` reproduces today's bytes.

That agreement is not guaranteed to hold forever. Prettier pads by display width, not `len()`, so the first CJK character, emoji or combining mark in any smell string makes the two disagree by one space. The gate's `prettier --write` step exists precisely to absorb that, which is why it is load-bearing rather than belt-and-braces.

**Acceptance criteria:**

- [ ] Rendering `index.md` from the committed seeds produces output byte-identical to the current `skills/qoq/assets/patterns/index.md`
- [ ] Rendering `react/index.md` from the committed seeds produces output byte-identical to the current `skills/qoq/assets/patterns/react/index.md`
- [ ] The rendered base table has 13 body rows, two of which link `strategy.md`
- [ ] The rendered react table has 9 body rows
- [ ] Neither rendered output contains the string `{{SMELLS_TABLE}}`
- [ ] A base row's Pattern cell is a link whose target is a bare basename with no directory component
- [ ] A react row's Pattern cell is a link whose target is a bare basename with no directory component
- [ ] Table rows appear in ascending `order` within each stack

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Ticket 4.3: The render gate

- **Status:** todo
- **Size:** S
- **Complexity:** mechanical
- **Agent tier:** `haiku`
- **Estimate:** `mechanical` · stack `monorepo-js` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 4.2
- **Files:**
  - Create: `scripts/render-gate.js`
  - Modify: `package.json`
  - Create: `scripts/render-gate.spec.mjs`

**Context:** Three `package.json` scripts and one node script that chains them:

- `"mcp:render": "uv run --project mcp python -m qoq_mcp.render"`
- `"mcp:gate": "node ./scripts/render-gate.js"`

`render-gate.js` runs the render, then `npx prettier --write 'skills/qoq/assets/patterns/**/*.md'`, then `git diff --exit-code -- skills/qoq/assets/patterns`. A non-zero exit from the diff is the failure, and the script's message must name the drifted files and say to run `npm run mcp:render` and commit the result — the same shape of guidance `sync-plugin-version.js` gives for `marketplace.json`.

The `prettier --write` between render and diff is not belt-and-braces. Prettier pads table cells by display width while the renderer pads by `len()`; the two agree today and will diverge the first time a smell string contains a wide character. With the Prettier step the renderer only has to be close; without it the renderer is a Prettier reimplementation with a version-pinned lifespan.

`husky:pre-push` (currently `run-s build smoke:bins check:engine test test:skill qoq:check`) gains the Python steps and the gate. Note this makes every `git push` in this repo require a working Python 3 and `uv` — a real cost, taken deliberately, and the reason it lands here rather than inside `qoq:check`. `qoq:check` is literally `qoq --check`, a CLI invocation with no hook for a custom step, so it stays pure-JS and a contributor without Python can still run it.

The spec file is `node:test`, not vitest — `vitest.config.js`'s `projects: ['packages/*']` never sees `scripts/`. It joins the existing `test:skill` conventions documented in CLAUDE.md.

**Acceptance criteria:**

- [ ] `npm run mcp:gate` exits 0 on a clean checkout with the committed seeds and committed renders
- [ ] Given a modified file under `skills/qoq/assets/patterns/`, the gate exits non-zero
- [ ] The gate's failure output contains the path of the drifted file
- [ ] The gate's failure output contains the string `mcp:render`
- [ ] `package.json`'s `husky:pre-push` script string contains `mcp:gate`
- [ ] `package.json`'s `qoq:check` script string is unchanged and contains no Python invocation

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Ticket 4.4: Version stamping and the documentation triple

- **Status:** todo
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural` · stack `monorepo-js` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 4.3
- **Files:**
  - Modify: `scripts/sync-plugin-version.js`
  - Modify: `CLAUDE.md`
  - Modify: `docs/qoq-design.md`
  - Create: `mcp/README.md`

**Context:** Two jobs, both about keeping written things true.

**Version stamping.** `sync-plugin-version.js` currently patches `.claude-plugin/marketplace.json` from `package.json`'s version and `SKILL.md`'s description, run by semantic-release's `prepare` step and committed by `@semantic-release/git`. It gains a third target: `mcp/src/qoq_mcp/__init__.py`'s `API_VERSION = "…"` literal. Patch it as text with a regex, the same way the existing two are patched, and assert the result afterwards the same way — the existing script throws if the patch did not take, and a silently-unstamped version is exactly the failure the `api_major` check exists to catch. Add `mcp/src/qoq_mcp/__init__.py` to `release.config.js`'s `@semantic-release/git` assets list, or the stamp is written and never committed.

**The documentation triple.** CLAUDE.md's standing rule is that skill prose, `docs/qoq-workflows.md` and `docs/qoq-design.md` all move in the same commit, in every direction. Here:

- `CLAUDE.md` — the "Monorepo Layout" section gains `mcp/`; the "The `qoq` skill and its diagrams" section must stop describing `assets/patterns/` as an authored catalogue and say it is generated from `mcp/db/seed/patterns/`, never hand-edited, with the gate named — the same sentence `marketplace.json` already earns in the Versioning section. The "Testing" section gains `pytest` and `ruff` alongside the existing vitest / `node:test` split.
- `docs/qoq-design.md` — one paragraph on why the write-ups became a render: the rationale that argues for a decision already made, which is what that file is for. The rules a reader must _act_ on stay in CLAUDE.md.
- `docs/qoq-workflows.md` — its diagram text names `assets/patterns/index.md` as what `qoq-designer` reads, which is still exactly true after this plan. **Verify no edit is needed rather than editing it**; landing a change here would describe plan 2's behaviour a plan early.

`mcp/README.md` covers running the server locally, rebuilding the database, and the never-hand-edit rule for `skills/qoq/assets/patterns/`.

Nothing in `skills/qoq/agents/qoq-designer.md` or `skills/qoq/references/refactor.md` is edited — both belong to plan 2. `refactor.md`'s "twenty-one of them" is a count the generator keeps true, not a line to change.

**Acceptance criteria:**

- [ ] Running `sync:plugin-version` with an explicit version argument rewrites `mcp/src/qoq_mcp/__init__.py` so `API_VERSION` equals that version
- [ ] Running it with a version argument still rewrites `marketplace.json`'s `metadata.version` to that version
- [ ] Given an `__init__.py` with no matching `API_VERSION` line, the script throws rather than writing a partially-synced set of files
- [ ] `release.config.js`'s `@semantic-release/git` assets list contains `mcp/src/qoq_mcp/__init__.py`
- [ ] `CLAUDE.md` contains the path `mcp/db/seed/patterns/` and states that `skills/qoq/assets/patterns/` is generated
- [ ] `CLAUDE.md` names `pytest` in its Testing section
- [ ] `docs/qoq-workflows.md` is unchanged by this ticket
- [ ] `npm run qoq:check` passes over the changed markdown

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Milestone 4 — Definition of done

- [ ] All tickets above are `done`
- [ ] `qoq refactor --decisions auto mcp/ scripts/ package.json release.config.js CLAUDE.md docs/qoq-design.md skills/qoq/assets/patterns` → clean
- [ ] Project's full build + full test suite green (`npm run build`, `npm test`), plus `pytest` under `mcp/` and `npm run mcp:gate`
- [ ] `git diff` over `skills/qoq/assets/patterns/` is empty after a fresh render — the milestone's central claim
- [ ] Both results written into the summary block's **Gate evidence**
- [ ] Milestone archived; summary block left under `## Completed`

---

## Milestone 5: Deploy

**Size:** M
**Goal:** A push to master builds, gates, deploys and restarts the server, and `https://mcp.adamczyk.ovh` answers both tools over streamable HTTP.
**Depends on:** Milestone 3, Milestone 4
**Contracts:** none — this milestone is configuration surfaces, and the interfaces it wires were fixed by Milestones 2, 3 and 4.

**Scenarios:**

- **Given** a push to master, **When** Woodpecker finishes, **Then** the current server code and a freshly built `patterns.db` are in `/home/joke/artifacts/mcp/` and the running service is serving them.
- **Given** a push whose seed change was not regenerated, **When** Woodpecker runs, **Then** the pipeline fails at the render gate and deploys nothing.
- **Given** an MCP client pointed at `https://mcp.adamczyk.ovh`, **When** it initialises a streamable-HTTP session, **Then** TLS validates and both tools are callable.
- **Given** a client exceeding the configured rate, **Then** nginx rejects the excess rather than the service absorbing it.

### Ticket 5.1: Woodpecker pipeline steps

- **Status:** todo
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural` · stack `infra` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 4.3
- **Files:**
  - Modify: `.woodpecker.yml`

**Context:** The existing pipeline runs on `push` to `master` with `node:22-alpine`, and deploys by writing into a host-mounted volume: `deploy-artefact` mounts `/home/joke/artifacts/qoq:/usr/build` and copies `build/` into it. `../cv/.woodpecker.yml` shows the same shape with a `python:3-alpine` step and a SQLite artifact under `/home/joke/artifacts/stats`. Follow both precedents rather than inventing a third.

New steps, after the existing `build`:

- A `python:3-alpine` step installing `uv`, then `uv run ruff check`, `uv run pytest`, and `npm run mcp:build`-equivalent to produce `mcp/build/patterns.db`.
- A render-gate step running `npm run mcp:gate`. This needs `apk add --no-cache git` — `git diff --exit-code` is the gate's last beat and the image ships without git, exactly as `../cv/.woodpecker.yml` does for its `showLastUpdateTime`.
- A `deploy-artefact`-shaped step mounting `/home/joke/artifacts/mcp:/usr/build`, copying the server source and `patterns.db` in. Copy `patterns.db` to a temp name and `mv` it into place, so a reader mid-request is never handed a partial file.

Order matters: the gate must run **before** the deploy step, or a drifted render still ships.

`npm ci` in the existing install step does not touch `mcp/` — `package.json`'s `workspaces` is `["packages/*"]` and `mcp/` is deliberately not a workspace. The Python steps are self-contained and set up their own environment.

**Acceptance criteria:**

- [ ] `.woodpecker.yml` parses as valid YAML
- [ ] It contains a step whose image is a Python image and whose commands include `ruff` and `pytest`
- [ ] It contains a step whose commands include `mcp:gate`
- [ ] The `mcp:gate` step appears before any step mounting `/home/joke/artifacts/mcp`
- [ ] The step running `mcp:gate` includes an `apk add` of `git`
- [ ] A step mounts `/home/joke/artifacts/mcp` as a volume
- [ ] The existing `deploy-artefact` and `trigger-downstream` steps are unchanged

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Ticket 5.2: systemd service and restart-on-deploy

- **Status:** todo
- **Size:** XS
- **Complexity:** mechanical
- **Agent tier:** `haiku`
- **Estimate:** `mechanical` · stack `infra` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 5.1
- **Files:**
  - Create: `mcp/deploy/qoq-mcp.service`
  - Create: `mcp/deploy/qoq-mcp.path`
  - Create: `mcp/deploy/README.md`

**Context:** `qoq-mcp.service` runs `uvicorn qoq_mcp.server:app` bound to **loopback only** — nginx is the entire perimeter, as it is for `stats`. Set `DB_PATH` to the deployed database's location. Use `DynamicUser` and a read-only filesystem where it does not fight `uv`; the service's hard rule is no writes and no filesystem access beyond `patterns.db`, so the unit should make that structurally true rather than merely intended.

`qoq-mcp.path` watches `/home/joke/artifacts/mcp/` and triggers a restart of the service when it changes. This exists because Woodpecker runs in a container that cannot `systemctl` the host — it can only write files into the artifacts directory, which is exactly what `../cv/.woodpecker.yml` does. A data-only change needs no restart (the server opens `patterns.db` by path per request), but a **code** change does, and without this unit the scenario "push to master, then the endpoint serves the new content" is only true for data.

These files are committed here but installed on the host by hand. `README.md` records the install commands and the fact that they are not applied by CI — a deliberate manual step, since nothing in this pipeline has host root.

**Acceptance criteria:**

- [ ] `qoq-mcp.service` parses under `systemd-analyze verify`
- [ ] `qoq-mcp.path` parses under `systemd-analyze verify`
- [ ] The service unit's `ExecStart` binds to a loopback address and not to `0.0.0.0`
- [ ] The service unit sets a `DB_PATH` environment variable
- [ ] The path unit's watched directory is `/home/joke/artifacts/mcp/`
- [ ] `mcp/deploy/README.md` states that the units are installed manually and names the install commands

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Ticket 5.3: nginx vhost

- **Status:** todo
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural` · stack `infra` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 5.2
- **Files:**
  - Create: `../nginx/sites-enabled/mcp.conf`
  - Modify: `../nginx/config/nginx.conf`

**Context:** **This ticket writes to a different repository** — `../nginx`, which is its own git checkout with its own history. Commit there separately; nothing in this plan's gates covers it, and `qoq fix` cannot be run against it. Treat its acceptance criteria as reviewed by inspection and by a live request, not by a spec.

`sites-enabled/stats.conf` is the closest existing vhost and the right model for **half** of itself. Copy: the TLS block (`listen 443 ssl`, `http2 on`, the three `ssl_*` certificate lines for `mcp.adamczyk.ovh`), the `include` lines for `security.conf`, `error_pages.conf` and `proxy_hide.conf`, and the `limit_req` / `limit_conn` pair. No `auth_basic.conf` — the surface is public read-only content, and the senders are unattended agent runs on other people's machines with no credential to give them, exactly as for stats.

Copy **nothing** from `stats.conf`'s `location = /`. All four of its distinctive choices are deliberate for a single-threaded fsyncing POST sink and every one of them breaks streamable HTTP: `proxy_http_version 1.0`, `Connection close`, 2-second timeouts, and POST-only via `limit_except`. This vhost needs HTTP/1.1, keep-alive, `proxy_buffering off`, and a long read timeout, because streamable HTTP holds an SSE response open.

The `limit_req_zone` itself is declared in `config/nginx.conf`, not in `sites-enabled/` — `stats.conf:38` says so explicitly. Add an `mcp` zone there.

Also unlike stats: keep the access log on. Stats disables it because anonymity is the entire point of that endpoint's payload; this one serves public documentation and an access log is ordinary operational data.

**Acceptance criteria:**

- [ ] `nginx -t` passes against the modified configuration
- [ ] `mcp.conf` contains `server_name mcp.adamczyk.ovh`
- [ ] `mcp.conf` contains `proxy_http_version 1.1` and does not contain `proxy_http_version 1.0`
- [ ] `mcp.conf` contains `proxy_buffering off`
- [ ] `mcp.conf` contains no `limit_except` directive
- [ ] `mcp.conf` contains no `include auth_basic.conf`
- [ ] `config/nginx.conf` declares a `limit_req_zone` whose zone name is used by `mcp.conf`
- [ ] A live `POST` to `https://mcp.adamczyk.ovh/mcp` initialising an MCP session returns a valid response over a certificate that validates

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS — **not applicable**; these files are outside this repository. Record the inspection instead.
- [ ] `qoq-test-reviewer` over the spec files → **not applicable**; no spec files. Record the live-request evidence instead.
- [ ] Every acceptance criterion ticked with its evidence — `nginx -t` output and the live request's response
- [ ] Change committed in `../nginx` after review; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Milestone 5 — Definition of done

- [ ] All tickets above are `done`
- [ ] `qoq refactor --decisions auto .woodpecker.yml mcp/deploy` → clean
- [ ] Project's full build + full test suite green (`npm run build`, `npm test`), plus `pytest` under `mcp/` and `npm run mcp:gate`
- [ ] A live `lookup_pattern` and a live `get_pattern` against `https://mcp.adamczyk.ovh` both return, and their `api_version` matches `package.json`'s version
- [ ] Both results written into the summary block's **Gate evidence**
- [ ] Milestone archived; summary block left under `## Completed`
