# @ladamczyk/qoq-eslint-v9-ts-react-structure — Agent Context

ESLint flat config template that enforces the **folder/file structure** of a TypeScript + React project, built on [`eslint-plugin-project-structure`](https://github.com/Igorkowalski94/eslint-plugin-project-structure).

## Exports

- `baseConfig` — standalone flat config enabling `project-structure/folder-structure`, built from `createFolderStructure()`
- `createFolderStructure(options?)` — builds the `project-structure/folder-structure` rule options for the TS + React structure, rooted at `src/` by default (`structureRoot: 'src'`). Exported on its own so the structure can be wired into a **single package within a monorepo** (override `structureRoot`/`projectRoot` to scope it, e.g. `packages/ui/src`, or merge extra `ignorePatterns`), not only consumed via `baseConfig`.
- The individual reusable rules are also exported, each with a `Rule` suffix, so a project can compose its own structure from them: `moduleFileRule`, `moduleSubfolderRule`, `componentsFolderRule`, `componentFolderRule`, `leafComponentFolderRule`, `featuresFolderRule`, `featureFolderRule`, `helpersFolderRule`.

## Usage

This is a **standalone** block — apply it as its own entry, separate from the linting template (it uses the project-structure parser, not the TS parser). The structure is rooted at `src/` by default, and files outside `src/` are left untouched.

```js
import { baseConfig } from '@ladamczyk/qoq-eslint-v9-ts-react-structure';

export default [{ ...baseConfig, files: ['**/*.{ts,tsx}'] }];
```

For a single package inside a monorepo, build a scoped rule with `createFolderStructure`, overriding the default `src` root:

```js
import { createFolderStructure } from '@ladamczyk/qoq-eslint-v9-ts-react-structure';
import { projectStructureParser, projectStructurePlugin } from 'eslint-plugin-project-structure';

export default [
  {
    files: ['packages/ui/**/*.{ts,tsx}'],
    plugins: { 'project-structure': projectStructurePlugin },
    languageOptions: { parser: projectStructureParser },
    rules: {
      'project-structure/folder-structure': [
        2,
        createFolderStructure({ structureRoot: 'packages/ui/src' }),
      ],
    },
  },
];
```

## Enforced structure

The structure is rooted at `src/`. Entry files directly in `src/` (`App.tsx`, `index.tsx`, `setupTests.ts`, `*.d.ts`) are ignored.

- `components/` — `PascalCase/` component folders (recursive) **or** flat `PascalCase.tsx|.ts`. A component folder may hold `<Name>.tsx|.ts`, `<Name>.spec.tsx|.ts`, `<Name>.css`, `index.ts`, nested `components/`, a directly-nested leaf component, and `helpers/`.
- `features/` — `PascalCase` feature folders (recursive via nested `features/`). A feature folder holds `<Name>.tsx|.ts`, `<Name>.spec.tsx|.ts`, `index.ts`, `types.ts`, `components/`, `helpers/`, and nested `features/`.
- `helpers/` — `camelCase` modules and specs, `PascalCase` providers/errors, and `camelCase` grouping sub-folders.
- `config/`, `store/`, `services/` — `camelCase` module files and `camelCase` sub-folders.

The config is intentionally permissive (taxonomy + casing, no strict folder-name inheritance), so an existing codebase is not flagged wholesale.
