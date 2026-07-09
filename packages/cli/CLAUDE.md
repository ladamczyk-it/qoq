# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (commands, qoq.config.js schema, generated files) lives in `AGENTS.md` — that file is shipped with the npm package so any agent in a consumer project can read it from `node_modules/@ladamczyk/qoq-cli/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./bin)
npm run build

# Build and run locally
npm run dev

# Run tests
npm test
```

## Internal architecture

**Config flow** (two directions):

- _Wizard / write_: `getPrompts()` → `getConfigFromModules()` → writes `qoq.config.js` (omits defaults)
- _Runtime / read_: `getModulesFromConfig()` → reads `qoq.config.js`, fills in all defaults → `execute()`

Each tool is a pair of classes in `src/modules/<tool>/`:

- `*ConfigHandler extends AbstractConfigHandler` — handles wizard prompts and config serialization/deserialization. Chained via `setNext()` in `getHandlerBySequence()` in `src/modules/index.ts`.
- `*Executor extends AbstractExecutor` (via one of the mid-level bases below) — implements `getCommandName()` and `prepare()` (writes the tool's generated config file into `bin/` and adjusts CLI args). The base `AbstractExecutor.run()` handles caching, timing, and the warmup shortcut; `execute()` is abstract and left to the mid-level base or the leaf class.

Executors split by how they drive the underlying tool:

- `AbstractCommandExecutor` — spawns the tool's binary via `executeCommand()`, using `getCommandArgs()` + whatever `prepare()` pushed onto `args`. Used by tools with no usable JS API (Knip, npm).
- `AbstractApiExecutor` — drives the tool's JS API directly instead of spawning a process (`getCommandArgs()` returns `[]`); provides a `writeReport()` helper for `--json` output. Used by Skillslint and Structurelint.
- `AbstractApiWithProgressExecutor extends AbstractApiExecutor` — adds live per-file progress output (`showProgress()`/`printProgress()`/`clearProgress()`/`finishProgress()`) for API-driven tools that stream over many files: ESLint, Prettier, Stylelint. None of these tools' JS APIs expose a public per-file callback, so each subclass feeds progress from whatever hook it can get — Prettier loops over files itself; ESLint/Stylelint inject an internal `qoq-internal/file-progress` rule/plugin purely to observe the filename as it's processed.

`PrettierExecutor` (extends `AbstractApiWithProgressExecutor`) drives `prettier`'s JS API directly rather than spawning its CLI — `execute()` calls `prettier.check()`/`prettier.format()` per resolved target (dynamically imported at runtime, so it resolves from the consumer's on-demand install; kept external in `rollup.bin.js`). Under `--json` it collects unformatted files into a lean report via `writeReport()` instead of printing.

`SkillslintExecutor` (extends `AbstractApiExecutor`) does not spawn a binary at all — it overrides `execute()` to call `@ladamczyk/skillslint`'s `lint()` + `format()` JS API directly (dynamically imported at runtime for the same reason as Prettier above). `format()` returns the skillslint CLI's console output verbatim; under `--json` it skips `format()` and writes `skillslint-report.json` itself.

`StructurelintExecutor` (extends `AbstractApiExecutor`) works the same way, driving `@ladamczyk/structurelint`'s `validate()` + `format()` JS API. The `structurelint` block in `qoq.config.js` mirrors structurelint's own config shape directly — no separate `structure.config.*` file is read.

`execute()` in `src/modules/index.ts` accepts an optional `tools?: string[]` fourth argument — when present, only executors whose name appears in the list are run. This powers the `qoq [tools...]` positional-arg feature.

To add a new tool: create `src/modules/<tool>/{*ConfigHandler.ts,*Executor.ts,types.ts}`, register the handler in the `setNext()` chain and the executor in `execute()` in `src/modules/index.ts`. Add `shouldRun('<name>')` guard to the executor call in `execute()` and, if `--json` output is needed, push the appropriate flag inside `prepare()`.

`formatCode()` in `src/helpers/formatCode.ts` just renders CJS or ESM file bodies for a given `EConfigType` — it does no detection itself. The format is resolved once in `BasicConfigHandler.getModulesFromConfig()`: the consumer's `qoq.config.js` `configType` field wins if set, otherwise it falls back to the consumer's `package.json` `"type"` field (`module` → ESM, else CJS).

## Cache behavior

All tools (except npm) use `--cache` by default; cache files land in `bin/.<toolname>cache`. During `--warmup`, existing caches are cleared before config files are pre-generated.

## JSON reporting (`--json`)

When `--json` is passed, each tool writes its output to `bin/report/` (or `--output <path>`). The directory is created automatically by `src/index.ts` before tools run. `executeCommand()` in `@ladamczyk/qoq-utils` accumulates all stdout chunks before resolving when `captureOutput=true` (fixed from resolving on the first chunk only).
