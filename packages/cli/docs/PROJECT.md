# Project structure and design

As stated in [root documentation](../README.md) with Qoq CLI we aim to provide minimal configuration for execution of multiple quality tools. In order to do so we provide:

1. **Config wizard** that creates qoq.config.js with selected options omitting defined defaults.
1. **Config handlers** that basically can omit defaults when writing config from wizard and apply defaults when we read config for CLI execution.
1. **Executors** that are responsible for executing tools with proper arguments, handle errors, timers etc.

**Structure:**

```
📦src
 ┣ 📂helpers
 ┃ ┗ ... // that holds all common helpers
 ┣ 📂modules
 ┃ ┣ 📂abstract
 ┃ ┃ ┣ 📜AbstractConfigHandler.ts // mandatory base for any ConfigHandler
 ┃ ┃ ┗ 📜AbstractExecutor.ts // mandatory base for any Executor
 ┃ ┣ 📂... // module handling for each tool including CLI itself
 ┃ ┣ 📜helpers.ts // modules helpers
 ┃ ┣ 📜index.ts // expose methods for ConfigHandlers and Executors usage
 ┃ ┗ 📜types.ts
 ┗ 📜index.ts // CLI execution file
```

## Config Wizard

Every `ConfigHandler` must extend `AbstractConfigHandler`, which requires implementing the `getPrompts` method. This method defines all wizard questions and answer mappings for a specific module.

The order of questions is defined in `./src/modules/index.ts` via a sequence. Adding a new module will likely require additional user prompts. Whenever possible, default values should be provided—either hardcoded if necessary or derived from previous answers. All `ConfigHandler` classes have access to `modulesConfig`, which stores configurations for all previous modules.

## Config Handlers

As mentioned above, every `ConfigHandler` must extend `AbstractConfigHandler`. In addition to `getPrompts`, two key methods are required:

- **`getConfigFromModules`** – Extracts all defaults from `IModulesConfig` to create `QoqConfig`, typically for config file storage.
- **`getModulesFromConfig`** – Compares `QoqConfig` with defaults, adding missing values where necessary to generate `IModulesConfig`, typically when running the CLI.

## Executors

Every `Executor` extends `AbstractExecutor` through one of two mid-level bases, chosen by how the tool is driven:

- **`AbstractCommandExecutor`** – for tools with no usable JS API (Knip, npm); implements `execute()` by spawning the tool's binary via `executeCommand()`.
- **`AbstractApiExecutor`** – for tools driven via their JS API instead of a spawned process (Skillslint, Structurelint); implements `getCommandArgs()` as `[]` and adds a `writeReport()` helper for `--json` output. Its subclass `AbstractApiWithProgressExecutor` adds live per-file progress output for API-driven tools that stream over many files (ESLint, Prettier, Stylelint).

Leaf classes typically implement:

- **`getCommandName`** – Returns the command/tool name.
- **`execute`** – Abstract on `AbstractExecutor`; usually satisfied by the mid-level base, but overridden directly when a tool needs custom `--json`/progress handling (e.g. `PrettierExecutor`, `StructurelintExecutor`).
- **`prepare`** – Handles logic before execution, such as adding/removing dynamic command arguments or writing a configuration file for the command to consume. Has a default implementation (adds cache args); override to extend it.

`getName` (human-readable command name) and `getCommandArgs` (static args) both have base-class defaults and only need overriding when a tool's behavior differs from them.

### Last but not least

The CLI supports both CommonJS and ESM formats. Every configuration must be formatted using the `formatCode` helper to ensure compatibility across both standards.
