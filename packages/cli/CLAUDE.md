# CLAUDE.md

Consumer-facing context (commands, `qoq.config.js` schema, generated files) lives in `AGENTS.md`.

## Commands

```bash
npm run build # Rolldown bundle + tsc declarations → ./bin
npm run dev   # Build and run locally
npm test      # from the repo root — no per-package test script
```

## Internal architecture

**Config flow** (two directions):

- _Wizard / write_: `getPrompts()` → `getConfigFromModules()` → writes `qoq.config.js` (omits defaults)
- _Runtime / read_: `getModulesFromConfig()` → reads `qoq.config.js`, fills in all defaults → `execute()`

Each tool is a pair of classes in `src/modules/<tool>/`:

- `*ConfigHandler extends AbstractConfigHandler` — wizard prompts and config (de)serialization. Listed in run order by `getHandlersBySequence()` in `src/modules/index.ts`; the caller iterates that array. Handlers don't delegate to one another — they all read and write the one shared `modulesConfig`/`config` pair, so the array is built once per flow and reused across the three passes.
- `*Executor extends AbstractExecutor` (via one of the mid-level bases below) — implements `getCommandName()` and `prepare()` (writes the tool's generated config file into `bin/` and adjusts CLI args). The base `AbstractExecutor.run()` handles caching, timing, and the warmup shortcut; `execute()` is abstract, left to the mid-level base or the leaf class.

Executors split by how they drive the underlying tool:

- `AbstractCommandExecutor` — spawns the tool's binary via `executeCommand()`, using `getCommandArgs()` + whatever `prepare()` pushed onto `args`. For tools with no usable JS API (Knip, npm).
- `AbstractApiExecutor` — drives the tool's JS API instead of spawning a process (`getCommandArgs()` returns `[]`). Used by Skillslint and Structurelint. `writeReport()` for `--json` lives on `AbstractExecutor`, since every executor — spawned or API-driven — writes the same `<tool>-report.json` convention that `skills/qoq/scripts/summarize.mjs` parses.
- `AbstractApiWithProgressExecutor extends AbstractApiExecutor` — adds live per-file progress (`showProgress()`/`printProgress()`/`clearProgress()`/`finishProgress()`) for API-driven tools that stream over many files: ESLint, Prettier, Stylelint. None of these tools' JS APIs expose a public per-file callback, so each subclass feeds progress from whatever hook it can get — Prettier loops over files itself; ESLint/Stylelint inject an internal `qoq-internal/file-progress` rule/plugin purely to observe the filename as it's processed.

`PrettierExecutor` (extends `AbstractApiWithProgressExecutor`) drives `prettier`'s JS API rather than spawning its CLI — `execute()` calls `prettier.check()`/`prettier.format()` per resolved target (dynamically imported at runtime, so it resolves from the consumer's on-demand install; kept external in `rolldown.config.js`). Under `--json` it collects unformatted files into a lean report via `writeReport()` instead of printing.

`SkillslintExecutor` and `StructurelintExecutor` (both `AbstractApiExecutor`) spawn no binary either — they override `execute()` to call `@ladamczyk/skillslint`'s `lint()` + `format()` and `@ladamczyk/structurelint`'s `validate()` + `format()` JS APIs, dynamically imported for the same reason as Prettier. `format()` returns each tool's CLI console output verbatim; under `--json` they skip it and write `skillslint-report.json` themselves. The `structurelint` block in `qoq.config.js` mirrors structurelint's own config shape directly — no separate `structure.config.*` file is read.

`execute()` in `src/modules/index.ts` dispatches from a `registry` array — one row per tool, in run order, carrying its `skip` flag and (for stylelint/structurelint/skillslint) the `moduleKey` whose config block must be present. One loop runs them all; `BasicExecutor` runs after it, unconditionally, since it is the self-check rather than a tool. `execute()` also takes an optional `tools?: string[]` fourth argument — when present, only executors whose name is in the list run. This powers `qoq [tools...]`.

To add a tool: create `src/modules/<tool>/{*ConfigHandler.ts,*Executor.ts,types.ts}`, add the handler to `getHandlersBySequence()` and one row to the `registry` in `execute()` (both in `src/modules/index.ts`), and — if `--json` output is needed — push the flag inside `prepare()`.

`formatCode()` in `src/helpers/formatCode.ts` renders CJS or ESM file bodies for a given `EConfigType`; it detects nothing itself. The format is resolved once in `BasicConfigHandler.getModulesFromConfig()`: the consumer's `qoq.config.js` `configType` wins if set, otherwise the consumer's `package.json` `"type"` field (`module` → ESM, else CJS).

## Cache behavior

All tools except npm and Prettier use `--cache` by default; Prettier is fast enough to re-check every target, and a per-file cache made staged-vs-full runs report stale results. Cache files land in `bin/.<toolname>cache`. `--warmup` clears existing caches before pre-generating config files.

## JSON reporting (`--json`)

Each tool writes its output to `bin/report/` (or `--output <path>`); `src/index.ts` creates the directory before tools run. `executeCommand()` in `@ladamczyk/qoq-utils` accumulates all stdout chunks before resolving when `captureOutput=true` — not the first chunk only.
