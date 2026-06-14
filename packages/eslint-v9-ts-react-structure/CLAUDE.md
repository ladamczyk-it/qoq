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

`src/index.ts` wraps `eslint-plugin-project-structure` and exports a single `baseConfig` — a **standalone** flat config. The `createFolderStructure(...)` call (hardcoded for `.ts`/`.tsx`) is inlined directly as the `project-structure/folder-structure` rule options. `baseConfig` sets `languageOptions.parser` to `projectStructureParser` and enables only that rule. It deliberately does **not** merge onto `qoq-eslint-v9-ts-react`, because folder-structure must run in its own config block with the structure parser, not the TypeScript parser.

Implementation notes that matter:

- The reusable rules use the plugin's `{camelCase}`/`{PascalCase}` name tokens — **without** a leading `$`. A `${PascalCase}` leaves a stray `$` (regex end-anchor) and silently matches nothing.
- The folder-structure root rule maps to the **project root** (derived from the plugin's own `node_modules` location), so `src` is expressed as a real child, not as the root node.
- `folderRecursionLimit` is kept small (3) and there is only one component recursion cycle (via `components/`); a directly-nested component is handled by the non-recursive `leaf_component_folder` to avoid exponential per-file rule-tree expansion.

The structure is modelled on the feature-sliced `ui` reference app and is intentionally permissive (folder taxonomy + casing, no strict folder-name inheritance, root `src` files ignored). Tighten via `${folderName}` inheritance and `enforceExistence` if a project wants it.
