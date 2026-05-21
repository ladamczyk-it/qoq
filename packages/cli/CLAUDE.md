# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (commands, qoq.config.js schema, generated files) lives in `AGENTS.md` — that file is shipped with the npm package so any agent in a consumer project can read it from `node_modules/@saashub/qoq-cli/AGENTS.md`.

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

To add a new tool: create `src/modules/<tool>/{*ConfigHandler.ts,*Executor.ts,types.ts}`, register the handler in the `setNext()` chain and the executor in `execute()` in `src/modules/index.ts`.

`formatCode()` in `src/helpers/formatCode.ts` generates CJS or ESM file bodies; format is detected from the consumer's `qoq.config.js` content.

## Cache behavior

All tools (except npm) use `--cache` by default; cache files land in `bin/.<toolname>cache`. During `--warmup`, existing caches are cleared before config files are pre-generated.
