# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (the enforced structure, exports) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-ts-react-structure/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` wraps `eslint-plugin-project-structure` and exports:

- The reusable rules, each as a `Rule`-suffixed const (`moduleFileRule`, `moduleSubfolderRule`, `componentsFolderRule`, `componentFolderRule`, `leafComponentFolderRule`, `featuresFolderRule`, `featureFolderRule`, `helpersFolderRule`). They are collected into a private `rules` object keyed by `ruleId` (snake_case, matching the `{ ruleId }` references). The consts are typed as `FolderRule` — derived as `NonNullable<FolderStructureConfig<RuleId>['rules']>[RuleId]` so the cross-references in `children` stay constrained to the `RuleId` union (the plugin's `FolderRecursionRule` is not exported).
- `createFolderStructure(options?)` — our own builder (aliases the plugin's `createFolderStructure` as `createProjectFolderStructure` to avoid a name clash). It returns the `project-structure/folder-structure` rule options for the `.ts`/`.tsx` structure, defaults `structureRoot` to `'src'`, and forwards `structureRoot`/`projectRoot`/`ignorePatterns` via a trailing `...options` spread, so the same structure can scope to a single package in a monorepo (e.g. `structureRoot: 'packages/ui/src'`).
- `baseConfig` — a **standalone** flat config built from `createFolderStructure()`. It sets `languageOptions.parser` to `projectStructureParser` and enables only that rule. It deliberately does **not** merge onto `qoq-eslint-v9-ts-react`, because folder-structure must run in its own config block with the structure parser, not the TypeScript parser.

Implementation notes that matter:

- The reusable rules use the plugin's `{camelCase}`/`{PascalCase}` name tokens — **without** a leading `$`. A `${PascalCase}` leaves a stray `$` (regex end-anchor) and silently matches nothing.
- `structureRoot` defaults to `'src'`, so the top-level `structure` children (`components`/`features`/`helpers`/`config`/`store`/`services`) map to children of `src/`; files outside `src/` are skipped entirely by the plugin. Entry files directly in `src/` (`App.tsx`, `index.tsx`, `setupTests.ts`, `*.d.ts`) are dropped via `ignorePatterns` (`*.ts`, `*.tsx`, `**/*.d.ts`).
- `features/` holds `PascalCase` feature folders **directly** (recursive via nested `features/`) — there is no separate lowercase "domain" layer.
- `folderRecursionLimit` is kept small (3) and there is only one component recursion cycle (via `components/`); a directly-nested component is handled by the non-recursive `leaf_component_folder` to avoid exponential per-file rule-tree expansion.

The structure mirrors the `single` reference app (a `src/`-rooted, feature-sliced React layout) and is intentionally permissive (folder taxonomy + casing, no strict folder-name inheritance, root entry files ignored). Tighten via `${folderName}` inheritance and `enforceExistence` if a project wants it.
