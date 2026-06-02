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
- `*Executor extends AbstractExecutor` — implements `getCommandName()`, `getCommandArgs()`, and `prepare()` (writes the tool's generated config file into `bin/` and adjusts CLI args). The base `run()` handles caching, timing, and the warmup shortcut.

`PrettierExecutor` overrides `run()` entirely to handle `--json` mode: it swaps `--check` for `--list-different`, captures stdout via `executeCommand(..., captureOutput=true)`, and writes `prettier-report.json` itself rather than relying on a Prettier CLI flag.

`execute()` in `src/modules/index.ts` accepts an optional `tools?: string[]` fourth argument — when present, only executors whose name appears in the list are run. This powers the `qoq [tools...]` positional-arg feature.

To add a new tool: create `src/modules/<tool>/{*ConfigHandler.ts,*Executor.ts,types.ts}`, register the handler in the `setNext()` chain and the executor in `execute()` in `src/modules/index.ts`. Add `shouldRun('<name>')` guard to the executor call in `execute()` and, if `--json` output is needed, push the appropriate flag inside `prepare()`.

`formatCode()` in `src/helpers/formatCode.ts` generates CJS or ESM file bodies; format is detected from the consumer's `qoq.config.js` content.

## Cache behavior

All tools (except npm) use `--cache` by default; cache files land in `bin/.<toolname>cache`. During `--warmup`, existing caches are cleared before config files are pre-generated.

## JSON reporting (`--json`)

When `--json` is passed, each tool writes its output to `bin/report/` (or `--output <path>`). The directory is created automatically by `src/index.ts` before tools run. `executeCommand()` in `@ladamczyk/qoq-utils` accumulates all stdout chunks before resolving when `captureOutput=true` (fixed from resolving on the first chunk only).
