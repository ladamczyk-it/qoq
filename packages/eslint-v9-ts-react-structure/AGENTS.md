# @ladamczyk/qoq-eslint-v9-ts-react-structure — Agent Context

ESLint flat config template that enforces the **folder/file structure** of a TypeScript + React project, built on [`eslint-plugin-project-structure`](https://github.com/Igorkowalski94/eslint-plugin-project-structure).

## Exports

- `baseConfig` — standalone flat config enabling `project-structure/folder-structure` (the `.ts`/`.tsx` structure is inlined as the rule options)

## Usage

This is a **standalone** block — apply it as its own entry, separate from the linting template (it uses the project-structure parser, not the TS parser).

```js
import { baseConfig } from '@ladamczyk/qoq-eslint-v9-ts-react-structure';

export default [{ ...baseConfig, files: ['src/**/*.{ts,tsx}'] }];
```

## Enforced structure

Root-level files in `src` (`main.tsx`, `App.tsx`, `types.ts`, `setupTests.ts`, `*.d.ts`) are ignored.

- `components/` — `PascalCase/` component folders (recursive) **or** flat `PascalCase.tsx|.ts`. A component folder may hold `<Name>.tsx|.ts`, `<Name>.spec.tsx`, `<Name>.css`, `index.ts`, nested `components/`, and `helpers/`.
- `features/` — lowercase `camelCase` domain folders, each with a nested `features/` (PascalCase feature folders, recursive) and optional `helpers/`. A feature folder mirrors a component folder plus `types.ts` and nested `features/`.
- `helpers/` — `camelCase` modules, `PascalCase` providers/errors, and `camelCase` grouping sub-folders.
- `config/`, `store/`, `services/` — `camelCase` module files and `camelCase` sub-folders.

The config is intentionally permissive (taxonomy + casing, no strict folder-name inheritance), so an existing codebase is not flagged wholesale.
