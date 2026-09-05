# QoQ MCP Pattern Server Implementation Plan

**Goal:** Serve the smell→design-pattern catalogue as a queryable read-only MCP server, with the seed files as the single source of truth from which the skill's shipped markdown is rendered.
**Architecture:** One standalone TypeScript package under `./mcp`, deliberately outside the npm workspace: YAML seed records (one file per pattern) are validated by a zod loader, loaded into a freshly-built SQLite file with an FTS5 index, and served over streamable HTTP by a stateless MCP app. The same validated records feed a generator that renders `skills/qoq/assets/patterns/**`, so the shipped markdown becomes a gated projection of the seeds rather than a second source. Deployment is out of scope: a Docker container owned elsewhere clones this repo, extracts `mcp/`, and runs `npm ci && npm run build && npm start` under pm2.
**Requirements source:** `/qoq plan` invocation of 2026-09-02, grilled to an empty frontier over four rounds. Re-grilled to an empty frontier on 2026-09-05 for the Python → TypeScript switch (17 further decisions); the Python delivery of Ticket 1.1 (`1edeaaf`) was reverted by `7a48d86` and nothing is frozen.
**Commands:** build `npm run build` · test `npm test`
**Plan status:** draft

**Scope boundary — this is plan 1 of 2.** Plan 1 owns _data and service_: the seed corpus, the database, the server, the render and its gate, and the standalone package contract. **No agent calls the server when this plan completes.** Plan 2 owns _consumers_: `.mcp.json` in the plugin, `qoq-designer`'s frontmatter and its anti-persuasion rule, `refactor.md`'s assessment-4 fallback flow, and `cli.yaml`'s `api_version` stamp. `qoq refactor` behaves identically before and after plan 1 — the render is byte-compatible with what ships today.

**Deployment is not in this plan.** No `.woodpecker.yml` change, no systemd unit, no nginx vhost. The container that runs this server is owned elsewhere and serves MCP servers extracted the same way from several repositories; routing and process supervision are its properties, not this repo's. What this plan owes it is a package that installs, builds and starts on the plain npm convention, and a README saying so.

---

## Milestone 1: The `mcp/` package and its seed corpus

**Size:** M
**Goal:** `mcp/` exists as a standalone TypeScript package on a configured lint lane, and `mcp/db/seed/patterns/**` holds all 21 patterns as validated YAML records with a loader that names the file and the field on any bad seed. Nothing else reads them yet.
**Depends on:** none
**Contracts:**

**The package.** `mcp/` is **not** an npm workspace and never becomes one — root `package.json`'s `workspaces` stays `["packages/*"]`. It carries its own `package.json` (`"type": "module"`, `"private": true`, `"version": "0.0.0"`), its own committed `package-lock.json`, its own `tsconfig.json`, its own `vitest.config.js` and its own `rolldown.config.js`.

`mcp/tsconfig.json` **inlines** its compiler options and carries no `extends`. This is not a style preference: the container extracts `mcp/` out of the clone, so `../tsconfig.json` does not exist at container build time and an `extends` pointing at it fails the build. Inline these, mirroring root `tsconfig.json`:

```
module: "nodenext", moduleDetection: "force", target: "es2023", types: ["node"],
strict, isolatedModules, noImplicitReturns, noUncheckedIndexedAccess,
exactOptionalPropertyTypes, allowImportingTsExtensions, allowSyntheticDefaultImports,
esModuleInterop, resolveJsonModule, skipLibCheck, declaration,
outDir: "./bin", rootDir: ".", include: ["./src"]
```

`strictPropertyInitialization` is deliberately omitted — it only matters for classes, and none are planned.

**Specs live at `mcp/src/**/*.spec.ts`**, beside their sources — never in a `mcp/tests/` directory. typescript-eslint runs with `projectService: true` (`packages/eslint-v9-ts/src/index.ts:40`), so a `.ts` file outside the nearest tsconfig's `include` makes ESLint **error** rather than warn. With `include: ["./src"]`, a spec anywhere else fails gate 1 on every ticket.

**The seed record.** One file per pattern at `mcp/db/seed/patterns/<slug>.yaml` (stack `base`) or `mcp/db/seed/patterns/react/<slug>.yaml` (stack `react`). Every prose field is a YAML literal block scalar (`|`), stored verbatim, never rewrapped.

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

The `examples` shape is a zod schema reused in **both** directions — the seed loader parses it out of YAML, and `get_pattern` parses it back out of the database's JSON column. One schema, so the two can never disagree:

```ts
const codeBlockSchema = z.strictObject({ lang: z.string(), code: z.string() });
const afterBlockSchema = z.strictObject({
  lang: z.string(),
  code: z.string(),
  note: z.string().nullable().default(null),
});
export const exampleSchema = z.strictObject({
  before: codeBlockSchema,
  after: z.array(afterBlockSchema).min(1),
  note: z.string().nullable().default(null),
});
export const examplesSchema = z.array(exampleSchema).min(1);
```

`.nullable().default(null)` rather than `.optional()` is load-bearing: the output type carries `note: string | null` **non-optional**, so `JSON.stringify` always emits the key and the `get_pattern` payload's `"note": null` is produced by construction rather than by a call-site fixup. It also means the criterion is `=== null`, never `=== undefined`.

`IndexEntry`: `order` = int (unique within its stack), `smell` = str, `cost` = str, `cheaper` = str.

Because `aliases` has a default, `z.input<typeof patternSchema>` and `z.infer<typeof patternSchema>` are genuinely different types. The port script writes the **input** shape; every downstream consumer reads the **inferred** one.

Derived, never stored: `name` = `slug` for `base`, `<stack>/<slug>` for `react`. `asset_path` = `assets/patterns/<slug>.md` or `assets/patterns/react/<slug>.md`. The shape heading is `## The TypeScript shape` for `base` and `## The React shape` for `react`.

Loader entry point: `loadSeeds(root: string): TPatternRecord[]`, throwing `SeedError` with a message of the form `mcp/db/seed/patterns/react/provider.yaml: unknown field 'smel'` or `…: missing required field 'intro'`. Every seed is validated before any caller acts on any of them.

**Type alias naming is enforced.** `@typescript-eslint/naming-convention` (`packages/eslint-v9-ts/src/index.ts:80-127`) requires type aliases to be `T`-prefixed PascalCase and interfaces `I`-prefixed. Every `z.infer` alias is a type alias: `TPatternRecord`, `TIndexEntry`, `TExample`. There is **no** `objectLiteralProperty` selector in that config, so the snake_case payload keys (`api_version`, `wrong_call`, `asset_path`, `index_entries`) need no rename and no disable comment.

**Scenarios:**

- **Given** a fresh clone, **When** `npm --prefix ./mcp ci` and a typecheck run, **Then** `mcp/` builds and typechecks with no reference to any file above it.
- **Given** the 21 committed write-ups and the two committed index tables, **When** the one-shot port runs, **Then** `mcp/db/seed/patterns/` holds 21 YAML records carrying 22 index entries between them, with every prose field a verbatim block scalar.
- **Given** a seed file with a misspelled key or a missing required one, **When** the loader runs, **Then** it throws naming that file and that field, and no caller receives a partial record set.
- **Given** all 21 seeds, **When** the loader runs, **Then** every record's derived `name` and `asset_path` match a file that exists under `skills/qoq/assets/patterns/`.

### Ticket 1.1: The `mcp/` package skeleton and its lint lane

- **Status:** todo
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural,mechanical` · stack `mcp-ts` · baseline 0/0
- **Escalation:** none
- **Depends on:** none
- **Needs approval:** `typescript`, `@types/node`, `vitest`, `rolldown`, `rimraf` and `tsx` as `mcp/` devDependencies. All but `tsx` already exist elsewhere in this repo at pinned versions; `tsx` is genuinely new and exists to run `build.ts` and `render.ts`, which are deliberately not in the shipped bundle.
- **Files:**
  - Create: `mcp/package.json`
  - Create: `mcp/tsconfig.json`
  - Create: `mcp/vitest.config.js`
  - Create: `mcp/src/version.ts`
  - Modify: `qoq.config.js`
  - Modify: `.prettierignore`

**Context:** This is the first non-`packages/*` TypeScript in the repo and the lane every later ticket is gated on. It lands first precisely so that `qoq fix` — gate 1 on all thirteen tickets — is a real check rather than a formatter-only no-op over unlinted TypeScript.

`mcp/package.json` declares `"type": "module"`, `"private": true`, `"version": "0.0.0"`, `"engines": { "node": ">=22.15.0" }`. **`"type": "module"` is unguarded here.** `scripts/smoke-bins.js` exists to catch a rolldown config emitting ESM against a manifest that never declared it, but it scans `./packages` only and only manifests carrying a `bin` field (`smoke-bins.js:15,60`), so `mcp/` gets no such cross-check. Omitting it makes `npm start` die with `Cannot use import statement outside a module` — in the container, not here.

Pin `typescript` at **`7.0.2`**, not root's `6.0.3`. The split across this repo is not arbitrary: every package that _compiles_ TypeScript (`packages/cli:56`, `utils`, `check-engine`, `knip`, `stylelint-*`) pins `7.0.2`, while the `eslint-v9-ts*` config packages pin `6.0.3` because they carry a `>=4.8.4 <6.1.0` peer range. `mcp/` compiles, so it takes `7.0.2`.

`mcp/tsconfig.json` inlines the option list in the milestone's **Contracts**, carries no `extends`, and sets `include: ["./src"]`, `outDir: "./bin"`, `rootDir: "."` — mirroring `packages/cli/tsconfig.json`. Two of those options change the code every later ticket writes, so they are stated in the Contracts rather than discovered one ticket at a time.

`mcp/vitest.config.js` is written **fresh** — do not import the root's `commonConfig`, which carries `projects: ['packages/*']` and would be wrong here. Globals stay off, matching the repo (`CLAUDE.md`'s `qoq:discovery` block).

`mcp/src/version.ts` holds `export const API_VERSION = '6.1.5';` and nothing else. It is stamped at release by `scripts/sync-plugin-version.js` (wired in Ticket 4.4), which is why it must be a plain assignment matchable by a regex, on its own line, and why the file must contain no other logic. Prettier's config sets `singleQuote: true` (`packages/prettier/src/config.js:4`), so the literal uses single quotes and a trailing semicolon — the stamping regex has to emit exactly that or the release commit lands unformatted.

`qoq.config.js` gains two eslint blocks, mirroring the `rules` object already defined at its top:

```js
{ template: 'qoq-eslint-v9-ts', files: ['mcp/src/**/*.ts'], ignores: ['**/*.spec.ts'], rules },
{ template: 'qoq-eslint-v9-ts-vitest', files: ['mcp/src/**/*.spec.ts'], ignores: [], rules },
```

`.prettierignore` gains `mcp/package-lock.json`. Prettier's `sources` is `['.']` so it walks `./mcp`, and `jsonRecursiveSort: true` (`packages/prettier-with-json-sort/src/config.js:6`) would re-sort the lockfile on every `qoq fix` while every `npm install` rewrites it in npm's own order — pure churn, ended by one line. The seed YAML is deliberately left in Prettier's hands.

**`.gitignore` needs no new entry — verify this rather than assuming it.** Its existing `**/bin`, `**/build` and `**/node_modules` entries already cover `mcp/bin`, `mcp/build` and `mcp/node_modules`. The one trap: **never name a directory under `mcp/` `lib/`**, because `**/lib` is ignored too and the contents would silently not be committed.

Knip is **not** widened to `mcp/`, and this is deliberate — see Ticket 4.4, which records why in `docs/qoq-design.md`.

**Acceptance criteria:**

- [ ] `mcp/tsconfig.json` parses as JSON and contains no `extends` key
- [ ] `mcp/tsconfig.json`'s `compilerOptions` contains `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `module` set to `nodenext`
- [ ] `mcp/package.json` has `type` equal to `module`, `private` equal to `true` and `version` equal to `0.0.0`
- [ ] `mcp/package.json`'s `devDependencies` contains `typescript` pinned to `7.0.2`
- [ ] `mcp/src/version.ts` matches `/^export const API_VERSION = '\d+\.\d+\.\d+';$/m` and contains no other statement
- [ ] `qoq.config.js`'s default export has an `eslint` array containing an entry whose `files` includes `mcp/src/**/*.ts` and whose `template` is `qoq-eslint-v9-ts`
- [ ] `qoq.config.js`'s `eslint` array contains an entry whose `files` includes `mcp/src/**/*.spec.ts` and whose `template` is `qoq-eslint-v9-ts-vitest`
- [ ] `.prettierignore` contains a line equal to `mcp/package-lock.json`
- [ ] Root `package.json`'s `workspaces` array does not contain any entry matching `mcp`

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Ticket 1.2: Seed record schema and loader

- **Status:** todo
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural,mechanical` · stack `mcp-ts` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 1.1
- **Needs approval:** `zod` (validation) and `yaml` (parsing) as `mcp/` runtime dependencies. There is no stdlib YAML, and JSON seeds would store prose as escaped `"line\nline"` strings, destroying the git-diff-as-change-record property that file-per-record exists for.
- **Files:**
  - Create: `mcp/src/seeds.ts`
  - Create: `mcp/src/seeds.spec.ts`
  - Modify: `mcp/package.json`

**Context:** `seeds.ts` defines the zod schemas for the contract in the milestone's **Contracts** and exports `loadSeeds(root: string): TPatternRecord[]`.

Use `z.strictObject()` throughout, so an unknown key is an error rather than a silently dropped field. Zod's `ZodError` carries `issues[].path` but not the file — catch per file and re-throw as `SeedError` with the path prefixed, so the message names both. `SeedError` is a small `Error` subclass local to this file; there is nothing reusable in `packages/utils` and `mcp/` must not depend on a workspace package it is not installed alongside. The nearest precedent for the error-message shape is `packages/check-engine/src/helpers/readJson.ts`, which distinguishes read failure from parse failure.

All files are read and validated before the function returns anything. A caller must never receive a half-loaded corpus.

`noUncheckedIndexedAccess` is on, so `issue.path[0]` and `match[1]` are `| undefined`. Narrow explicitly rather than asserting — the same discipline every later ticket needs, and the reason it is called out in the Contracts.

Parse with `yaml`'s `parse` only. Nothing in this plan ever calls its `stringify` — see Ticket 1.3 for why.

Specs go at `mcp/src/seeds.spec.ts`, not `mcp/tests/`. Use the repo's temp-dir idiom for the fixture corpora: `mkdtempSync(join(tmpdir(), 'qoq-mcp-'))` with `rmSync(dir, { recursive: true, force: true })` in `afterAll`, exactly as `packages/cli/src/helpers/common.spec.ts:48-82` does. Vitest globals are off — import `describe`, `it`, `expect` explicitly.

**Acceptance criteria:**

- [ ] `loadSeeds` on a directory containing a YAML file with an unknown key throws `SeedError` whose message contains both that file's path and the unknown key's name
- [ ] `loadSeeds` on a directory containing a YAML file missing a required key throws `SeedError` whose message contains both that file's path and the missing key's name
- [ ] A record with `stack: base` and `slug: strategy` exposes `name` equal to `strategy` and `asset_path` equal to `assets/patterns/strategy.md`
- [ ] A record with `stack: react` and `slug: provider` exposes `name` equal to `react/provider` and `asset_path` equal to `assets/patterns/react/provider.md`
- [ ] A record whose `examples` list is empty fails validation
- [ ] A record whose `index_entries` list is empty fails validation
- [ ] An `Example` whose `after` list is empty fails validation
- [ ] A seed omitting `aliases` yields a record whose `aliases` is an empty array
- [ ] A seed whose `examples[0]` omits `note` yields a record whose `examples[0].note` is `null`, not `undefined`
- [ ] `loadSeeds` throws before returning when any one file in the directory is invalid, even if others are valid

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Ticket 1.3: One-shot port of the 21 write-ups into seed records

- **Status:** todo
- **Size:** M
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `mechanical,pattern-repeat` · stack `mcp-ts` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 1.2
- **Files:**
  - Create: `mcp/src/port.ts`
  - Create: `mcp/src/port.spec.ts`
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

**Context:** A throwaway script, run once via `tsx`, reviewed as a diff, and deleted in the same commit that lands the YAML it produced. It is not a maintained tool — the seed files are the source the moment it has run, and all later content changes are PRs against the YAML. Mark it with a `ponytail:` comment saying exactly that.

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

1. **Never call `yaml`'s `stringify`.** Like pyyaml's `dump` before it, a serialiser folds long lines and can silently convert a `|` block scalar to a quoted string when the value has trailing whitespace or no final newline. Emit block scalars by direct string construction. Every line break in all 21 files is hand-authored — `packages/prettier/src/config.js` sets no `proseWrap`, so it defaults to `preserve` and Prettier will not restore a break that gets normalised away. The worst concrete case is `skills/qoq/assets/patterns/react/control-props.md:31-32`, an inline code span split across a hand-wrapped line break; any normaliser "fixes" it and the gate goes permanently red.
2. **Use `|` (clip) uniformly** for every prose field, and let Milestone 4's renderer own the separators between sections. `|-` and `|+` change the trailing newline count per field, and getting `further_reading` wrong once makes all 21 rendered files differ by a blank line.

The script writes the **input** shape — `z.input<typeof patternSchema>` — since `aliases` is defaulted rather than required. `noUncheckedIndexedAccess` makes every `match[1]` and `lines[i]` in the parser `| undefined`; narrow rather than assert.

Code inside the fences is already Prettier-formatted — `embeddedLanguageFormatting` defaults to `auto`, which is why `composite.md:22-23` and `:60-61` carry that oddly-split union. Extracting verbatim from the committed files preserves that for free.

**Acceptance criteria:**

- [ ] `loadSeeds` over `mcp/db/seed/patterns/` returns exactly 21 records
- [ ] Those 21 records carry exactly 22 `index_entries` between them
- [ ] The record with `slug: strategy` carries exactly 2 `index_entries`, and every other record carries exactly 1
- [ ] Exactly 12 records have `stack: base` and exactly 9 have `stack: react`
- [ ] Every record's derived `asset_path` names a file that exists under `skills/qoq/assets/patterns/`
- [ ] The `react/props-getters` record has an example whose `before.lang` is `tsx` and whose `after` blocks include a block with `lang` equal to `ts` and a block with `lang` equal to `tsx`
- [ ] The `react/portal` record has an example with a block whose `lang` is `html`
- [ ] Each of `facade`, `decorator`, `template-method` has `examples[0].note` equal to `null`
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
- [ ] `qoq refactor --decisions auto mcp/ qoq.config.js .prettierignore` → clean
- [ ] Project's full build + full test suite green (`npm run build`, `npm test`), plus `npm --prefix ./mcp test`
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

Build entry point: `build(seedRoot: string, structureRoot: string, out: string): void`. Migration order is the filename sort of `*.sql`. There is no `schema_migrations` ledger: nothing is ever applied to an existing database, so a ledger would record a fact no code reads.

One `search` row per **index entry** — 22 rows — carrying that entry's own smell and cost plus its pattern's `intro`, `smell`, `cost` and `aliases`. That is what lets `bm25()` rank entries directly, so `lookup_pattern` is one query with no post-sort. No triggers and no external-content `rebuild`: the database is built fresh and is read-only at runtime, so there is nothing to keep in sync.

**The SQLite driver is `node-sqlite3-wasm`, and it has two non-obvious constraints.**

**Import it as a default, never as a named export.** Verified against 0.8.60: `import * as m from 'node-sqlite3-wasm'` yields exactly `['default']`. `import { Database } from 'node-sqlite3-wasm'` therefore throws `SyntaxError: Named export 'Database' not found` **at load time** — and `tsc` cannot see it, because the shipped `.d.ts` declares the named export regardless. Every file that opens a database uses:

```ts
import sqlite from 'node-sqlite3-wasm';
const { Database } = sqlite;
```

**Never set `PRAGMA journal_mode = WAL`.** WAL creates `-wal` and `-shm` sidecar files, and the single-file atomic swap that the whole build and deploy story rests on stops being atomic. The default rollback journal is correct here.

**Scenarios:**

- **Given** a checkout with no `patterns.db`, **When** the build runs, **Then** a `patterns.db` exists holding 21 patterns, 22 index entries and 22 searchable rows.
- **Given** one seed file that fails validation, **When** the build runs, **Then** it exits non-zero naming that file, and no `patterns.db` is created or replaced.
- **Given** a second migration file added to `db/structure/`, **When** the build runs, **Then** migrations apply in filename order and the resulting schema reflects the last one.

### Ticket 2.1: Initial migration and the migration runner

- **Status:** todo
- **Size:** XS
- **Complexity:** mechanical
- **Agent tier:** `haiku`
- **Estimate:** `mechanical` · stack `mcp-ts` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 1.1
- **Needs approval:** `node-sqlite3-wasm` as a `mcp/` runtime dependency. Node's built-in `node:sqlite` is not an option: official Node builds ship SQLite without `SQLITE_ENABLE_FTS5` on every version, verified locally on 22.15.0 — `CREATE VIRTUAL TABLE … USING fts5` fails with `no such module: fts5`. `better-sqlite3` was rejected because on Alpine musl it compiles from source, which would mean installing Python to build the SQLite driver for a project moving off Python.
- **Files:**
  - Create: `mcp/db/structure/0001_initial.sql`
  - Create: `mcp/src/migrate.ts`
  - Create: `mcp/src/migrate.spec.ts`
  - Modify: `mcp/package.json`

**Context:** `applyMigrations(db: Database, structureRoot: string): void` reads every `*.sql` under `structureRoot`, sorts by filename, and executes each against the connection with `db.exec`. The database it is handed is always brand new and empty — the build creates a fresh file every run — so there is no ledger, no "already applied" check, and no down-migrations.

The schema itself is fixed by the milestone's **Contracts** above; transcribe it. Two points that are load-bearing and easy to lose: `examples` stays a single JSON text column because it is served verbatim and never queried — shredding it into three tables buys a join and nothing else — and `search` is a plain FTS5 table, not `content=` external-content, because there is no base table to stay in sync with at runtime.

Sequential migration files are deliberate even though the database is rebuilt from scratch every build: schema evolution is reviewable as a diff, and `0002_*.sql` is where a later field lands.

This is the first ticket that opens a database, so it is where the default-import form in the milestone's **Contracts** gets proved. `prepare()` is fine here and in `build.ts` — the statement's lifetime is one function — but request paths use `db.all` / `db.run` instead, because a `Statement` needs an explicit `finalize()` and a leaked one is the way to make `close()` misbehave.

`:memory:` works for specs and is the right default; only the atomic-swap criteria in Ticket 2.2 need real files.

**Acceptance criteria:**

- [ ] `applyMigrations` against an in-memory database creates tables named `patterns`, `index_entries` and `search`
- [ ] Given a structure directory holding `0002_b.sql` and `0001_a.sql`, `applyMigrations` executes `0001_a.sql` before `0002_b.sql`
- [ ] After `applyMigrations`, inserting two `index_entries` rows with the same `stack` and `sort_order` throws
- [ ] After `applyMigrations`, inserting two `patterns` rows with the same `name` throws
- [ ] After `applyMigrations`, a `search` row can be inserted and retrieved with a `MATCH` query
- [ ] After `applyMigrations`, a `bm25(search)` expression in an `ORDER BY` returns rows without throwing

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
- **Estimate:** `architectural,mechanical` · stack `mcp-ts` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 2.1, Ticket 1.3
- **Files:**
  - Create: `mcp/src/build.ts`
  - Create: `mcp/src/build.spec.ts`
  - Modify: `mcp/package.json`
  - Modify: `package.json`

**Context:** `build(seedRoot, structureRoot, out)` does four things in this order: call `loadSeeds` (which throws on any bad seed before returning anything), create a fresh SQLite file at a temporary path, apply the migrations, bulk-insert the records, and only then rename the temp file over `out`.

**The temp file must sit in the same directory as `out`**, not in `tmpdir()`. `fs.renameSync` is only atomic within one filesystem, and a `tmpdir()` on a different mount silently degrades to a copy — which is exactly the non-atomic write the temp file exists to prevent. Name it `<out>.tmp`.

The rename at the end satisfies two separate requirements: a failed build leaves the previous `patterns.db` untouched rather than half-written, and a server reading the file by path per request picks up a swapped file with no restart. **Both are verified working** under `node-sqlite3-wasm` — an open-read-close, a rename over the path, then a second open returns the new file's contents.

Per record: one `patterns` row (with `examples` serialised as JSON and `aliases` newline-joined), one `index_entries` row per entry, and one `search` row per entry carrying that entry's `smell` and `cost` plus the pattern's `intro`, `smell`, `cost` and `aliases`.

Add to `mcp/package.json`'s scripts: `"mcp:build": "tsx src/build.ts"`. Add to root `package.json`'s scripts: `"mcp:build": "npm --prefix ./mcp run mcp:build"`. Do **not** add `mcp/` to root `workspaces`.

The build output goes to `mcp/build/patterns.db`. Root `.gitignore` already carries `**/build`, so it is ignored without a new entry — confirm that rather than assuming it.

**`mcp/node_modules` is a documented manual prerequisite**, not something any root script installs. Root `npm ci` honours `workspaces: ["packages/*"]` and never touches `mcp/`. Where this script can cheaply detect a missing install, it should say `run npm --prefix ./mcp ci` rather than surfacing a bare module-resolution error — the failure otherwise looks like a code bug on every fresh clone.

**Acceptance criteria:**

- [ ] Running `build` against the committed seed corpus produces a file containing exactly 21 rows in `patterns`
- [ ] That file contains exactly 22 rows in `index_entries` and exactly 22 rows in `search`
- [ ] Every `search` row's `entry_id` matches an existing `index_entries.id`
- [ ] The `patterns` row for `strategy` has an `examples` column that parses as JSON to a list of length 1
- [ ] A `MATCH` query for `switch` against `search` returns at least one row whose `entry_id` belongs to the `strategy` pattern
- [ ] Given a seed directory containing one invalid file, `build` throws and no file exists at the output path
- [ ] Given an output path where a valid `patterns.db` already exists, and a seed directory containing one invalid file, `build` throws and the existing file's contents are unchanged
- [ ] After a successful `build`, no file matching `*.tmp` remains in the output directory
- [ ] Running `build` twice in a row produces a file with the same row counts both times
- [ ] The built database contains no `journal_mode` of `wal`

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
- [ ] Project's full build + full test suite green (`npm run build`, `npm test`), plus `npm --prefix ./mcp test`
- [ ] Both results written into the summary block's **Gate evidence**
- [ ] Milestone archived; summary block left under `## Completed`

---

## Milestone 3: The pattern tools

**Size:** M
**Goal:** `lookupPattern` and `getPattern` answer correctly against a built database, every response carrying the version envelope — as pure functions, with no listener and no transport.
**Depends on:** Milestone 2
**Contracts:**

**The seam that makes this milestone assertable.** Tool logic never touches the transport. `lookup.ts` and `fetch.ts` are pure functions taking an already-open database; `config.ts` is a pure function of the environment; `db.ts` owns opening and the envelope. Nothing in this milestone imports the MCP SDK, express, or binds a port — that is Milestone 5's single ticket, and it is the only file in the package with no spec.

```ts
// mcp/src/config.ts
export const resolveServerConfig = (env: NodeJS.ProcessEnv): TServerConfig => …
// TServerConfig = { host: string; port: number; dbPath: string; allowedHosts?: string[] }

// mcp/src/db.ts
export const openDb = (dbPath: string): Database => …      // readOnly, fileMustExist, by path
export const envelope = <T extends object>(fields: T): T & TEnvelope => …

// mcp/src/lookup.ts, mcp/src/fetch.ts
export const lookupPattern = (db: Database, smellDescription: string, limit: number): TLookupResponse => …
export const getPattern = (db: Database, name: string): TGetPatternResponse => …
```

`@typescript-eslint/explicit-module-boundary-types` is on (`packages/eslint-v9-ts/src/index.ts:128`), so every exported function carries its return type explicitly, as above.

**One row-mapper per table, and nothing else touches a raw row.** `node-sqlite3-wasm` returns `Record<string, SQLiteValue>`, so with `noUncheckedIndexedAccess` every column read is `SQLiteValue | undefined` and every `rows[0]` is `| undefined`. Left ad hoc this becomes eleven inline casts; contained, it is two functions that throw on a shape violation:

```ts
const rowToLookupResult = (row: TSqliteRow): TLookupResult => …
const rowToPattern = (row: TSqliteRow): TPattern => …
```

**The envelope.** Every response, success or not-found, carries at top level:

```json
{ "api_version": "6.1.5", "api_major": 6 }
```

`api_major` is an integer, comparable with `!=`, needing no semver parsing. `api_version` is the npm workspace version — the whole toolkit moves in lockstep, so a breaking change to these two tool schemas can only be expressed as a major release of `@ladamczyk/qoq`. Both derive from `mcp/src/version.ts`'s `API_VERSION` literal; the server touches no file but `patterns.db`.

Derive the major with `Number.parseInt(API_VERSION, 10)`, **not** `Number(API_VERSION.split('.')[0])`. Under `noUncheckedIndexedAccess` the split index is `string | undefined`, and `Number(undefined)` is `NaN` with no type error at all.

`lookupPattern(db, smellDescription, limit = 5)`:

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

Rows are **index entries**, not patterns: `name`, `pattern_name` and `asset_path` may repeat across rows in one result set, because Strategy owns two entries and a caller must see the entry that actually matched. `score` is `-bm25(search)` — higher is better, no meaning across queries. No body field ever. An empty `results` list is a valid answer, not an error.

`getPattern(db, name)` — `name` is the stack-prefixed slug (`strategy`, `react/provider`):

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

Not found is a **result, not an error**:

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

- **Given** a built database, **When** a caller runs `lookupPattern` with "the same switch on a type tag appears in four modules", **Then** Strategy's divergent-switch entry comes back ranked above less relevant rows, carrying its smell, cost, cheaper alternative, slug and asset path, and no body.
- **Given** a free-text description containing words that are FTS5 query syntax, **When** `lookupPattern` runs, **Then** it returns results rather than throwing.
- **Given** a caller built against an older major, **When** it reads any response from either tool, **Then** it detects the incompatibility from one integer field without parsing a version string.
- **Given** `getPattern("react/provider")`, **Then** the full record comes back including every example; **given** a name that does not exist, **Then** a not-found result naming the closest matches, not a thrown error.
- **Given** `patterns.db` is replaced by an atomic rename between two calls, **When** the next call opens it, **Then** it reads the new file.

### Ticket 3.1: Config, database access and the version envelope

- **Status:** todo
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural` · stack `mcp-ts` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 2.2
- **Files:**
  - Create: `mcp/src/config.ts`
  - Create: `mcp/src/db.ts`
  - Create: `mcp/src/config.spec.ts`
  - Create: `mcp/src/db.spec.ts`

**Context:** Two small modules that everything in Milestones 3 and 5 sits on.

`config.ts` exports `resolveServerConfig(env)` — a pure function, no I/O, no `process.env` reference of its own, so it is assertable by passing an object. It reads four variables:

- `PORT` — **required, with no default.** The container that runs this server hosts several MCP servers extracted from different repositories and assigns ports itself; guessing one here is how two servers collide. Missing or unparseable `PORT` throws with a message naming the variable.
- `HOST` — defaults to `127.0.0.1`. That default is what turns the SDK's DNS-rebinding protection on, so it is a security default rather than a convenience one.
- `DB_PATH` — defaults to `./build/patterns.db`, matching where Ticket 2.2's build writes.
- `ALLOWED_HOSTS` — optional, comma-separated. Absent means the key is **absent from the returned object**, not `undefined`: `exactOptionalPropertyTypes` is on, so build it with a spread — `{ ...(allowedHosts && { allowedHosts }) }` — because assigning `undefined` to an optional property is a type error under that flag.

`db.ts` owns two things. `envelope(fields)` returns an object that always starts with `api_version` (from `mcp/src/version.ts`) and `api_major`, merged with the caller's fields, so no tool can forget it. And `openDb(dbPath)`:

```ts
import sqlite from 'node-sqlite3-wasm';
const { Database } = sqlite;
export const openDb = (dbPath: string): Database =>
  new Database(dbPath, { readOnly: true, fileMustExist: true });
```

Opened **fresh per request, by path**. Holding a long-lived connection keeps the old inode alive after a rename, and opening by path is what picks up a swapped file — verified working against this driver.

The default-import form is not optional. `import { Database } from 'node-sqlite3-wasm'` compiles cleanly and then throws `SyntaxError: Named export 'Database' not found` at load, because the package's only ESM export is `default` and the shipped `.d.ts` does not reflect that.

**Acceptance criteria:**

- [ ] `envelope({})` returns an object whose `api_version` equals the exported `API_VERSION`
- [ ] `envelope({})` returns an object whose `api_major` is a number equal to the integer before the first dot of `API_VERSION`
- [ ] `envelope({ found: true })` returns an object containing `api_version`, `api_major` and `found`
- [ ] `resolveServerConfig` with `PORT` unset throws an error whose message contains `PORT`
- [ ] `resolveServerConfig` with `PORT` set to a non-numeric string throws an error whose message contains `PORT`
- [ ] `resolveServerConfig({ PORT: '9000' })` returns `host` equal to `127.0.0.1`
- [ ] `resolveServerConfig({ PORT: '9000' })` returns an object that does not have the own property `allowedHosts`
- [ ] `resolveServerConfig({ PORT: '9000', ALLOWED_HOSTS: 'a.example,b.example' })` returns `allowedHosts` equal to an array of those two strings
- [ ] `resolveServerConfig({ PORT: '9000', DB_PATH: '/tmp/x.db' })` returns `dbPath` equal to `/tmp/x.db`
- [ ] A database opened by `openDb` throws on an attempted `INSERT`
- [ ] `openDb` against a path with no file throws rather than creating one
- [ ] Given a database file, a first `openDb` and read, then a rename of a different database over that path, a second `openDb` reads the replaced file's contents

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Ticket 3.2: `lookupPattern`

- **Status:** todo
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural` · stack `mcp-ts` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 3.1
- **Files:**
  - Create: `mcp/src/lookup.ts`
  - Create: `mcp/src/lookup.spec.ts`

**Context:** A pure function taking an open database, `smellDescription: string` and `limit: number` (default 5), returning the payload in the milestone's **Contracts**.

The single thing most likely to be got wrong: **`smellDescription` must never reach `MATCH` raw.** It is free prose, and `AND`, `OR`, `NOT`, `NEAR`, `"`, `*`, `:`, `-` and `(` are all FTS5 query syntax. A sentence containing any of them throws — not a bad ranking, a crash. Sanitise, then join with `" OR "`:

```ts
const tokens = (text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []).filter((t) => t.length >= 3);
```

The `u` flag and the property escapes are not decoration. JavaScript's `\w` is ASCII-only, so the obvious `\w+` translation of the original silently drops every accented or non-Latin word from the query.

An input that leaves no tokens returns an empty `results` list rather than querying.

This is worth stating because the scenario's own example sentence happens to contain no syntax characters, so a test written from the scenario alone passes while the first real caller who writes "loading or error" gets a stack trace. Cover it explicitly.

The query joins `search` to `index_entries` to `patterns`, orders by `bm25(search)` ascending, and returns `-bm25(search)` as `score` so higher is better. One query, no post-sort — the FTS rows are already per-entry. Use `db.all(sql, params)`, not `db.prepare`; a `Statement` needs an explicit `finalize()` and this runs in a request path.

Rows are index entries. Strategy owns two, so a query matching both returns two rows with the same `name`, `pattern_name` and `asset_path`. That is correct and deliberate: collapsing them would show the caller a smell string that is not the one their query matched.

**On the `score` assertion.** Do not assert `score > 0`. Measured against this corpus, `-bm25()` lands at around `2.9e-6` when a term appears in most rows — a threshold that can pass on a broken ranker and fail on a working one. Assert the ordering and the identity of the top row instead, which is what the scenario actually claims.

**Acceptance criteria:**

- [ ] `lookupPattern` with "the same switch on a type tag appears in four modules" returns results whose first row has `name` equal to `strategy`
- [ ] That first row's `smell` is the divergent-switch entry, not Strategy's other index entry
- [ ] Every row returned has exactly the keys `name`, `pattern_name`, `stack`, `smell`, `cost`, `cheaper`, `asset_path`, `score`
- [ ] No row returned contains any of the keys `intro`, `examples`, `wrong_call`, `further_reading`
- [ ] `lookupPattern` with "loading or error state" returns without throwing
- [ ] `lookupPattern` with `a "quoted" NEAR* thing (here)` returns without throwing
- [ ] `lookupPattern` with an accented word that appears in a seed returns at least one row
- [ ] `lookupPattern` with "zzzz" returns a response whose `results` is an empty array and whose `api_major` is present
- [ ] `lookupPattern` with "a" returns a response whose `results` is an empty array
- [ ] A query matching both Strategy entries returns two rows with `name` equal to `strategy` and different `smell` values
- [ ] Every returned `score` is a finite number, and the rows are in non-increasing `score` order
- [ ] `lookupPattern` with "switch" and a limit of 2 returns at most 2 rows

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Ticket 3.3: `getPattern`

- **Status:** todo
- **Size:** XS
- **Complexity:** mechanical
- **Agent tier:** `haiku`
- **Estimate:** `mechanical` · stack `mcp-ts` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 3.1
- **Files:**
  - Create: `mcp/src/fetch.ts`
  - Create: `mcp/src/fetch.spec.ts`

**Context:** A pure function taking an open database and `name: string` — the stack-prefixed slug, `strategy` or `react/provider` — returning the payload in the milestone's **Contracts**.

On a hit: one row from `patterns` by `name`, with `examples` parsed back from its JSON column, `aliases` split on newlines into an array (an empty stored value yields `[]`, not `['']`), and the pattern's `index_entries` rows attached in `sort_order`.

**Parse `examples` back through `examplesSchema`** — the same schema `seeds.ts` exports, not a second one. This is not politeness: `JSON.parse` returns `any`, and `@typescript-eslint/no-unsafe-return` is on (only `no-unsafe-assignment` is disabled in this repo's TS template), so returning an unvalidated parse result fails lint. Running it through zod is what makes the file both correct and lintable, and it guarantees the served shape can never drift from the stored one.

On a miss: `found: false`, never a thrown error. `closest` comes from a small string-distance pass over the 21 names — with a corpus this size a linear scan is the whole implementation, and no index or dependency is needed. A miss with no close matches returns an empty `closest` array, which is still a valid response.

**Acceptance criteria:**

- [ ] `getPattern` with `react/provider` returns a response with `found` true whose `pattern.name` is `react/provider`
- [ ] That response's `pattern.examples` is an array whose first item has `before` and `after` keys, with `after` a non-empty array
- [ ] That response's `pattern.examples[0].after[0].note` is either a string or `null`, never `undefined`
- [ ] That response's `pattern.aliases` is an array
- [ ] A pattern whose stored `aliases` is empty yields `pattern.aliases` equal to an empty array
- [ ] `getPattern` with `strategy` returns a response whose `pattern.index_entries` has length 2
- [ ] Those two `index_entries` are ordered by their stored `sort_order`
- [ ] `getPattern` with `react/providers` returns a response with `found` false, `requested` equal to `react/providers`, and `closest` containing an entry with `name` `react/provider`
- [ ] `getPattern` with `qqqqqqqq` returns a response with `found` false and `closest` an empty array, without throwing
- [ ] Every response, hit or miss, carries `api_version` and `api_major`
- [ ] `getPattern` with `provider` — the bare slug of a react pattern — returns `found` false

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
- [ ] Project's full build + full test suite green (`npm run build`, `npm test`), plus `npm --prefix ./mcp test`
- [ ] Both results written into the summary block's **Gate evidence**
- [ ] Milestone archived; summary block left under `## Completed`

---

## Milestone 4: The render and its gate

**Size:** M
**Goal:** `skills/qoq/assets/patterns/**` becomes a byte-identical render of the seed corpus, with drift caught as a failing check before every push, and the docs saying so.
**Depends on:** Milestone 1
**Contracts:**

Generator entry point: `render(seedRoot: string, templateRoot: string, outRoot: string): void`.

**Every path is a parameter.** Nothing inside `mcp/` ever names `skills/` — the output root arrives from the root-level `mcp:render` script. This is what keeps `mcp/` extractable: the renderer is dev-only code that happens to live in the package, and it never references a directory the container does not have.

**Input**: the same validated records `loadSeeds` returns — one loader, two consumers — plus `mcp/render/templates/index.md` and `mcp/render/templates/react/index.md`. Each template is that index file's committed prose verbatim (`Stacks`, `The other ten GoF patterns` / `The other twelve from the catalogue`, `What the caller does with a finding`) with one line holding the literal token `{{SMELLS_TABLE}}`. A token rather than an HTML comment, because the marker must not survive into the output.

**Output**: exactly 23 files, all of them, every run, never a delete — 12 at `<outRoot>/<slug>.md`, 9 at `<outRoot>/react/<slug>.md`, plus both `index.md` files.

**Pure**: output is a function of seeds and templates only. No timestamps, no directory-listing order, no locale. Files iterated sorted by `name`; table rows by `index_entries[].order`.

Per write-up, in order: `# {title}`, blank, `intro`, `## The smell it answers` + `smell`, `## The cheaper thing first` + `cheaper`, `## The {TypeScript|React} shape`, `### Before` + the one before-fence, `### After` + each after-block (fence, then its `note` where present), then `examples[0].note` where present, `## What it costs` + `cost`, `## When it's the wrong call` + `wrong_call`, `## Further reading` + `further_reading`. Exactly one blank line between blocks; exactly one trailing newline at EOF.

**Only `examples[0]` is rendered.** A record's second and later examples are served by `getPattern` and never appear in the markdown. This is the settled resolution of the conflict between a list-valued field and a byte-identical gate: the shipped file stays exactly the floor, and the extra examples become the concrete thing the server has that the file does not.

Index table: header `| Smell | Costs you | Cheaper first | Pattern |`, Pattern cell `[{title}]({slug}.md)` — a bare basename, since base rows link within `assets/patterns/` and react rows within `assets/patterns/react/`. Cells padded to the maximum `length` in that column.

Gate, run by `husky:pre-push`:

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
- **Estimate:** `architectural,pattern-repeat` · stack `mcp-ts` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 1.3
- **Files:**
  - Create: `mcp/src/render.ts`
  - Create: `mcp/src/render.spec.ts`

**Context:** Renders one pattern record to the exact bytes of its committed markdown file, for all 21. The section order and separator rules are in the milestone's **Contracts**; the rest of this is what makes hitting them actually possible.

The shape heading is derived from `stack` — `## The TypeScript shape` for `base`, `## The React shape` for `react` — never stored, because it is perfectly correlated across all 21 files.

Three things that will otherwise cost attempts:

1. **Trailing newlines.** Every prose field is stored as a `|` (clip) block scalar, which means each ends with exactly one newline. The renderer owns every separator between sections; do not add a field's own trailing newline to a separator and get two.
2. **`examples[0]` only.** Later examples are not rendered at all. A record with three examples renders identically to the same record with one.
3. **Prettier runs after this.** The gate pipes the output through `prettier --write` before diffing, so this renderer does not have to be a Prettier reimplementation — it has to be close, and Prettier settles the bytes. Do not attempt to reproduce Prettier's exact code formatting inside fences; the stored code is already embedded-formatted because it was extracted from files Prettier had already processed.

One consequence worth knowing about: `embeddedLanguageFormatting` defaults to `auto`, so a stored snippet that does not parse as its declared `lang` makes Prettier throw on the whole generated file, and the error names the generated file rather than the seed that caused it. Where the renderer can cheaply attach the source record's path to such a failure, do.

`noUncheckedIndexedAccess` makes `examples[0]` itself `| undefined` — the schema guarantees at least one, but the type does not, so narrow once at the top rather than at every use.

**Acceptance criteria:**

- [ ] For each of the 21 records, the rendered string equals the current contents of the file at its `asset_path`, byte for byte
- [ ] A `base` record renders a line `## The TypeScript shape` and no line `## The React shape`
- [ ] A `react` record renders a line `## The React shape` and no line `## The TypeScript shape`
- [ ] A record whose `examples` list has two items renders identically to the same record with only the first item
- [ ] A rendered write-up ends with exactly one newline character
- [ ] A record whose `examples[0].after` has two blocks renders two fenced blocks under `### After`
- [ ] A record whose `examples[0].after[0].note` is set renders that prose between the first and second fenced blocks
- [ ] A record whose `examples[0].note` is `null` renders no prose between the last after-block and `## What it costs`

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
- **Estimate:** `architectural` · stack `mcp-ts` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 4.1
- **Files:**
  - Create: `mcp/render/templates/index.md`
  - Create: `mcp/render/templates/react/index.md`
  - Modify: `mcp/src/render.ts`
  - Create: `mcp/src/render-index.spec.ts`

**Context:** The two templates are the committed `index.md` and `react/index.md` with their "smells worth hunting" table replaced by a line containing only `{{SMELLS_TABLE}}`. Everything else in those files — `Stacks`, `The other ten GoF patterns` / `The other twelve from the catalogue`, `What the caller does with a finding` — is hand-written prose that belongs to no record and is carried verbatim.

Table rows come from every record's `index_entries` for that stack, ordered by `order`. Base has 12 patterns but **22 rows across both tables**: `strategy` owns two entries in the base table (`index.md:33` and `index.md:35` in the current file), so the base table has 13 rows.

Column padding is the cell padded to the maximum `length` in that column. This has been measured against the committed file and matches: `index.md:32`'s first separator cell is exactly 83 dashes, and 83 is the plain `length` of the longest cell — `**Recursive special-casing** — leaf and container handled separately at every level`. Prettier is counting the em-dash as width 1 there, so a naive pad reproduces today's bytes.

That agreement is not guaranteed to hold forever. Prettier pads by display width, not code-unit count, so the first CJK character, emoji or combining mark in any smell string makes the two disagree by one space. The gate's `prettier --write` step exists precisely to absorb that, which is why it is load-bearing rather than belt-and-braces.

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
  - Create: `scripts/render-gate.spec.mjs`
  - Modify: `package.json`
  - Modify: `mcp/package.json`

**Context:** Two npm scripts and one node script that chains them.

- `mcp/package.json` gains `"mcp:render": "tsx src/render.ts"`, which takes the output root as an argument.
- Root `package.json` gains `"mcp:render": "npm --prefix ./mcp run mcp:render -- ../skills/qoq/assets/patterns"` and `"mcp:gate": "node ./scripts/render-gate.js"`.

`render-gate.js` runs the render, then `npx prettier --write 'skills/qoq/assets/patterns/**/*.md'`, then `git diff --exit-code -- skills/qoq/assets/patterns`. A non-zero exit from the diff is the failure, and the script's message must name the drifted files and say to run `npm run mcp:render` and commit the result — the same shape of guidance `sync-plugin-version.js` gives for `marketplace.json`.

The `prettier --write` between render and diff is not belt-and-braces. Prettier pads table cells by display width while the renderer pads by code-unit count; the two agree today and will diverge the first time a smell string contains a wide character. With the Prettier step the renderer only has to be close; without it the renderer is a Prettier reimplementation with a version-pinned lifespan.

`husky:pre-push` (currently `run-s build smoke:bins check:engine test test:skill qoq:check`) gains `test:scripts`, `test:mcp` and `mcp:gate`. **`mcp:gate` must come before `qoq:check`** — a render that lands unformatted after the check has already passed is a green push with a dirty tree. Root `package.json` also gains `"test:mcp": "npm --prefix ./mcp test"`.

**`scripts/*.spec.mjs` currently has no runner at all, and this ticket is what introduces the first one.** `test:skill` globs `skills/qoq/scripts/*.spec.mjs` and never sees `scripts/`; `vitest.config.js`'s `projects: ['packages/*']` never sees it either. Without a third script this ticket's own spec file would be dead on arrival. Add `"test:scripts": "node --test 'scripts/*.spec.mjs'"` — quoted glob, expanded by node rather than the shell, exactly as `test:skill` does — and wire it into `husky:pre-push` alongside the other two.

**`mcp/node_modules` is a documented manual prerequisite** — root `npm ci` never installs it, and both `test:mcp` and `mcp:gate` need it. Where this script can cheaply detect its absence, it should say `run npm --prefix ./mcp ci` rather than surfacing a module-resolution error that reads like a code bug.

The spec file is `node:test`, not vitest — `vitest.config.js`'s `projects: ['packages/*']` never sees `scripts/`. It joins the existing `test:skill` conventions documented in CLAUDE.md: flat `test('sentence', …)` calls with no `describe`, `node:`-prefixed imports, and the script driven as a subprocess via `spawnSync` because the contract under test is the exit code.

**Acceptance criteria:**

- [ ] `npm run mcp:gate` exits 0 on a clean checkout with the committed seeds and committed renders
- [ ] Given a modified file under `skills/qoq/assets/patterns/`, the gate exits non-zero
- [ ] The gate's failure output contains the path of the drifted file
- [ ] The gate's failure output contains the string `mcp:render`
- [ ] `package.json`'s `husky:pre-push` script string contains `mcp:gate`
- [ ] `package.json`'s `husky:pre-push` script string contains `test:mcp`
- [ ] `package.json`'s `test:scripts` script is `node --test 'scripts/*.spec.mjs'`
- [ ] `package.json`'s `husky:pre-push` script string contains `test:scripts`
- [ ] In `package.json`'s `husky:pre-push` script string, `mcp:gate` appears before `qoq:check`
- [ ] `package.json`'s `qoq:check` script string is unchanged and equal to `qoq --check`
- [ ] `package.json`'s `test` script string is unchanged

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
  - Modify: `release.config.js`
  - Modify: `CLAUDE.md`
  - Modify: `docs/qoq-design.md`

**Context:** Two jobs, both about keeping written things true.

**Version stamping.** `sync-plugin-version.js` currently patches `.claude-plugin/marketplace.json` from `package.json`'s version and `SKILL.md`'s description. It gains a third target: `mcp/src/version.ts`'s `API_VERSION` literal.

Three things about the existing script's shape have to be preserved, and a second target threatens all three:

1. **It is atomic today by construction** — one assertion at line 31, one `writeFileSync` at line 35. With two targets it must compute _both_ patched strings, assert _both_, and only then write either. A partially-synced set of files is exactly what its existing `throw` prevents, and a naive second block reintroduces it.
2. **The assertion cannot be a parse-and-readback.** That trick works for `marketplace.json` because `JSON.parse` is available; a `.ts` file has no parser to hand. Assert by re-matching the exact emitted line against the patched string.
3. **The emitted line must already be Prettier-clean.** semantic-release commits between `prepare` and any formatting run, and this repo's Prettier config sets `singleQuote: true`. The literal is `export const API_VERSION = '6.1.5';` — single quotes, trailing semicolon, on its own line.

Add `mcp/src/version.ts` to `release.config.js`'s `@semantic-release/git` assets list, or the stamp is written and never committed. `mcp/package.json` is deliberately **not** added: `semantic-release-lerna` only bumps `packages/*/package.json`, so its `0.0.0` stays put by construction and there is no second version source to disagree with the one that matters.

**The documentation triple.** CLAUDE.md's standing rule is that skill prose, `docs/qoq-workflows.md` and `docs/qoq-design.md` all move in the same commit, in every direction. Here:

- `CLAUDE.md` — the "Monorepo Layout" section gains `mcp/`, described as a standalone package deliberately outside the workspace. The "The `qoq` skill and its diagrams" section must stop describing `assets/patterns/` as an authored catalogue and say it is generated from `mcp/db/seed/patterns/`, never hand-edited, with the gate named — the same sentence `marketplace.json` already earns in the Versioning section. The "Testing" section gains `mcp/`'s vitest and the `test:mcp` script alongside the existing vitest / `node:test` split, and states that `mcp/node_modules` is a manual prerequisite.
- `docs/qoq-design.md` — three paragraphs of rationale for decisions already made, which is what that file is for: why the write-ups became a render; **why nothing about `mcp/` runs in CI**, and that the render gate therefore lives only in a bypassable local hook; and **why `mcp/` has no knip coverage** — the CLI derives knip's workspace keys from `package.json`'s `workspaces`, so a non-workspace directory cannot be given entry points at all, and adding them to the shared config would analyse nothing while adding noise to every real workspace. Both gaps are deliberate and should read that way rather than as oversights.
- `docs/qoq-workflows.md` — its diagram text names `assets/patterns/index.md` as what `qoq-designer` reads, which is still exactly true after this plan. **Verify no edit is needed rather than editing it**; landing a change here would describe plan 2's behaviour a plan early.

Nothing in `skills/qoq/agents/qoq-designer.md` or `skills/qoq/references/refactor.md` is edited — both belong to plan 2. `refactor.md`'s "twenty-one of them" is a count the generator keeps true, not a line to change.

**Acceptance criteria:**

- [ ] Running `sync:plugin-version` with an explicit version argument rewrites `mcp/src/version.ts` so its `API_VERSION` literal equals that version
- [ ] Running it with a version argument still rewrites `marketplace.json`'s `metadata.version` to that version
- [ ] The line it writes into `mcp/src/version.ts` uses single quotes and ends with a semicolon
- [ ] Given a `version.ts` with no matching `API_VERSION` line, the script throws and `marketplace.json` is left unmodified
- [ ] Given a `marketplace.json` whose version pattern does not match, the script throws and `mcp/src/version.ts` is left unmodified
- [ ] `release.config.js`'s `@semantic-release/git` assets list contains `mcp/src/version.ts`
- [ ] `release.config.js`'s `@semantic-release/git` assets list does not contain `mcp/package.json`
- [ ] `CLAUDE.md` contains the path `mcp/db/seed/patterns/` and states that `skills/qoq/assets/patterns/` is generated
- [ ] `CLAUDE.md` names `test:mcp` in its Testing section
- [ ] `docs/qoq-design.md` contains a passage explaining why `mcp/` has no CI coverage
- [ ] `docs/qoq-design.md` contains a passage explaining why `mcp/` has no knip coverage
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
- [ ] Project's full build + full test suite green (`npm run build`, `npm test`), plus `npm --prefix ./mcp test` and `npm run mcp:gate`
- [ ] `git diff` over `skills/qoq/assets/patterns/` is empty after a fresh render — the milestone's central claim
- [ ] Both results written into the summary block's **Gate evidence**
- [ ] Milestone archived; summary block left under `## Completed`

---

## Milestone 5: The standalone package contract

**Size:** S
**Goal:** `mcp/`, extracted on its own, installs, builds and starts under the plain npm convention, serving both tools over streamable HTTP.
**Depends on:** Milestone 3
**Contracts:**

**The container contract, in full.** A Docker container owned elsewhere clones this repo, extracts `mcp/`, and runs exactly:

```
npm ci  &&  npm run build  &&  npm start
```

Everything below follows from that and nothing else is assumed. In particular the container is **not** given a pm2 config, a Dockerfile, a systemd unit or an nginx vhost by this repo — it hosts MCP servers extracted the same way from several repositories, and those are its properties.

- `npm ci` requires **`mcp/package-lock.json` to be committed**. It also installs devDependencies, which `npm run build` needs — the container must not pass `--omit=dev`.
- `npm run build` is `rimraf ./bin && rolldown -c && tsc --emitDeclarationOnly && tsx src/build.ts`. It produces `bin/server.js` and `build/patterns.db` in one command, so code and data can never be out of step.
- `npm start` is `node bin/server.js`.
- `PORT` is **required**; `HOST`, `DB_PATH` and `ALLOWED_HOSTS` are optional with the defaults in Milestone 3's `resolveServerConfig`.

`mcp/rolldown.config.js` mirrors `packages/cli/rolldown.config.js`: externals computed from `package.json`'s `dependencies` plus `builtinModules` as plain strings, `platform: 'node'`, `output.dir: './bin'`, `entryFileNames: '[name].js'`, and **no `format` key**, so it emits ESM against the manifest's `"type": "module"`.

**`node_modules` must sit beside `bin/` at runtime.** `node-sqlite3-wasm` loads its `.wasm` from a path relative to its own package directory, so it stays external in the bundle — which it will, since externals come from `dependencies`. `npm ci && npm run build && npm start` gives this for free; a copy-only deploy of `bin/` alone would not, and this is the one thing about the contract that is not obvious from the commands.

`src/build.ts` and `src/render.ts` are **not** rolldown entry points and never reach `bin/`. They run under `tsx` at build and development time only.

**Scenarios:**

- **Given** `mcp/` copied alone into an empty directory, **When** `npm ci && npm run build` runs, **Then** both succeed with no reference to any file above it, and `bin/server.js` and `build/patterns.db` exist.
- **Given** the built package and `PORT` set, **When** `npm start` runs, **Then** the process binds and both tools are callable over streamable HTTP.
- **Given** no `PORT`, **When** `npm start` runs, **Then** it exits with a message naming the variable rather than binding a guessed port.
- **Given** no `HOST`, **Then** it binds `127.0.0.1` and DNS-rebinding protection is active.

### Ticket 5.1: The server entry point

- **Status:** todo
- **Size:** S
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `architectural,mechanical` · stack `mcp-ts` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 3.2, Ticket 3.3
- **Needs approval:** `@modelcontextprotocol/sdk` as a `mcp/` runtime dependency. It brings `express`, `hono`, `cors`, `ajv`, `jose`, `pkce-challenge` and `eventsource` transitively — a large tree, taken deliberately because hand-rolling the streamable HTTP transport is not a thing to own. Third-party MCP frameworks (`fastmcp`, `xmcp`, `mcp-framework`, `mcp-handler`) were considered and rejected: what they add over the SDK — auth, sessions, OpenAPI conversion, media resources, progress notifications, custom routes — is exactly the feature set this server deliberately does not have.
- **Files:**
  - Create: `mcp/src/server.ts`
  - Create: `mcp/src/manifest.spec.ts`
  - Create: `mcp/rolldown.config.js`
  - Modify: `mcp/package.json`

**Context:** The only file in the package that mentions the SDK, express or a port, and the only one with no spec — which is precisely why Milestone 3 put every decision worth asserting behind a pure function first. Keep it thin: if logic accumulates here, it belongs in a specced module instead.

The SDK's shape, verified against 1.30.0:

- `createMcpExpressApp(options?)` from `@modelcontextprotocol/sdk/server/express` takes **only** `{ host?, allowedHosts? }`. It returns a bare express app with `express.json()` and host-header validation applied. **It does not mount any MCP route and it does not listen** — the caller does both.
- `host` passed to `createMcpExpressApp` selects the middleware; it does **not** bind. Pass the same host to `app.listen(port, host)` or the protection and the bind disagree — protection on `127.0.0.1` while listening on `0.0.0.0` is the failure mode worth naming.
- With `allowedHosts` present the SDK applies host-header validation against that list. With it absent and `host` a loopback address it applies localhost validation automatically. With `host` set to `0.0.0.0` and no `allowedHosts` it prints a warning and applies nothing — which is why `ALLOWED_HOSTS` exists.
- `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` is the documented stateless mode: no session ID in any response, no session validation.
- `transport.handleRequest(req, res, req.body)` takes the pre-parsed body; `createMcpExpressApp` has already applied `express.json()`.

Tools are registered with `McpServer.registerTool` and delegate immediately:

```ts
const db = openDb(cfg.dbPath);
try {
  return lookupPattern(db, smellDescription, limit);
} finally {
  db.close();
}
```

Open and close per request. That is what makes the atomic database swap work, and closing in a `finally` is what keeps a throwing tool from leaking a handle.

Verify the single-shared-transport shape against the SDK's own stateless example before writing the handler — the JSDoc shows one transport reused across requests, and that is the one detail here worth confirming rather than assuming.

`mcp/package.json` gains `"start": "node bin/server.js"` and the `build` script in the milestone's **Contracts**.

**`server.ts` itself stays unspecced, and that is deliberate** — it is why Milestone 3 put every decision worth asserting behind a pure function first. But the packaging around it is very much assertable, and `mcp/src/manifest.spec.ts` is where that happens: it reads `mcp/package.json` and `mcp/rolldown.config.js` as data and asserts their shape, and greps `mcp/src/` to prove the SDK import is confined to one file. It is a vitest spec under `mcp/src/`, so `include: ["./src"]` covers it and `npm --prefix ./mcp test` runs it; it must not import `server.ts`, which would bind a port at import time.

**Acceptance criteria:**

- [ ] `mcp/package.json`'s `start` script is `node bin/server.js`
- [ ] `mcp/package.json`'s `build` script contains `rolldown -c`, `tsc --emitDeclarationOnly` and `tsx src/build.ts`
- [ ] `mcp/rolldown.config.js` has exactly one input entry and it resolves to `src/server.ts`
- [ ] `mcp/rolldown.config.js` declares no `format` key
- [ ] `mcp/rolldown.config.js`'s `external` includes every key of `mcp/package.json`'s `dependencies`
- [ ] `mcp/rolldown.config.js`'s inputs do not include `src/build.ts` or `src/render.ts`
- [ ] After `npm run build` in `mcp/`, a file exists at `mcp/bin/server.js`
- [ ] After `npm run build` in `mcp/`, `mcp/bin/` contains no `render.js` and no `build.js`
- [ ] `mcp/src/server.ts` is the only file under `mcp/src/` matching `@modelcontextprotocol/sdk`

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Ticket 5.2: The committed lockfile and the container contract

- **Status:** todo
- **Size:** S
- **Complexity:** mechanical
- **Agent tier:** `haiku`
- **Estimate:** `mechanical` · stack `mcp-ts` · baseline 0/0
- **Escalation:** none
- **Depends on:** Ticket 5.1
- **Files:**
  - Create: `mcp/package-lock.json`
  - Create: `mcp/README.md`
  - Create: `mcp/src/standalone.spec.ts`

**Context:** The deliverable this milestone exists for: proving `mcp/` really does stand alone, and writing down what the container gets.

`mcp/package-lock.json` is generated by `npm --prefix ./mcp install` and **committed**. `npm ci` in the container requires it. `.prettierignore` already excludes it from Ticket 1.1.

`mcp/README.md` states the contract in the milestone's **Contracts** and four things a reader cannot infer from the code:

- The three commands, and that `--omit=dev` breaks the build because `tsx` and `rolldown` are devDependencies.
- The env surface: `PORT` required, `HOST`/`DB_PATH`/`ALLOWED_HOSTS` optional with their defaults, and that leaving `HOST` alone is what keeps DNS-rebinding protection on.
- That `node_modules` must sit beside `bin/` at runtime, because `node-sqlite3-wasm` resolves its `.wasm` relative to its own package directory.
- That `"type": "module"` is load-bearing and **unguarded** — `scripts/smoke-bins.js` checks `./packages` only, and only manifests carrying a `bin` field, so nothing in this repo will catch its removal. The symptom is `Cannot use import statement outside a module` at container start.

It also records that `skills/qoq/assets/patterns/` is generated from `mcp/db/seed/patterns/` and must never be hand-edited, and that `mcp/node_modules` is a manual prerequisite for the root repo's own gates.

`mcp/src/standalone.spec.ts` is the extraction proof, and it is the only thing that actually tests the milestone's central claim. It copies `mcp/` — excluding `node_modules`, `bin` and `build` — into a temp directory outside the repo with `mkdtempSync(join(tmpdir(), 'qoq-mcp-standalone-'))`, runs `npm ci` and `npm run build` there via `spawnSync`, and asserts both exit 0 and the expected artefacts exist, cleaning up with `rmSync(dir, { recursive: true, force: true })`.

It lives under `mcp/src/` as a vitest spec rather than in `scripts/` as `node:test`, for one reason that decides it: it is a claim about `mcp/`, so it belongs to `test:mcp`, and a `scripts/` spec would instead run under the `test:scripts` runner Ticket 4.3 introduces for root scripts. It is slow — a real `npm ci` — and that cost is the point; nothing cheaper actually proves extraction works. Give it a generous vitest timeout explicitly rather than letting the default kill it.

**Acceptance criteria:**

- [ ] `mcp/package-lock.json` exists, parses as JSON, and its `lockfileVersion` is at least 3
- [ ] `mcp/package-lock.json`'s root package name matches `mcp/package.json`'s name
- [ ] `mcp/README.md` contains the string `npm ci && npm run build && npm start`
- [ ] `mcp/README.md` names `PORT` and states that it is required
- [ ] `mcp/README.md` states that `--omit=dev` breaks the build
- [ ] `mcp/README.md` states that `skills/qoq/assets/patterns/` is generated and must not be hand-edited
- [ ] Copying `mcp/` without `node_modules`, `bin` or `build` into a directory outside the repository and running `npm ci` there exits 0
- [ ] Running `npm run build` in that copied directory exits 0
- [ ] That copied directory then contains `bin/server.js` and `build/patterns.db`
- [ ] No file under `mcp/src/`, `mcp/tsconfig.json`, `mcp/rolldown.config.js` or `mcp/vitest.config.js` contains the string `../` in a module specifier or a `extends` value

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:**

- **Log:**

**Commit:** none

### Milestone 5 — Definition of done

- [ ] All tickets above are `done`
- [ ] `qoq refactor --decisions auto mcp/ scripts/` → clean
- [ ] Project's full build + full test suite green (`npm run build`, `npm test`), plus `npm --prefix ./mcp test` and `npm run mcp:gate`
- [ ] A live `lookup_pattern` and a live `get_pattern` against a locally started `npm start` both return, and their `api_version` matches `package.json`'s version
- [ ] Both results written into the summary block's **Gate evidence**
- [ ] Milestone archived; summary block left under `## Completed`
