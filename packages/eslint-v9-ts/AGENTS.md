# @saashub/qoq-eslint-v9-ts — Agent Context

ESLint flat config template for TypeScript projects. Extends `@saashub/qoq-eslint-v9-js` and adds TypeScript-specific rules.

## Exports

- `baseConfig` — full TS config (extends JS base)
- `testConfig` — relaxed variant of `baseConfig` for test files (disables unsafe-argument, unsafe-assignment, unsafe-member-access, no-duplicate-string)

## Usage

Typically consumed via `qoq.config.js` using the `template` field. For manual use:

```js
import { baseConfig } from '@saashub/qoq-eslint-v9-ts';

export default [baseConfig];
```

## Added on top of the JS base

- **Parser**: `typescript-eslint` with `projectService: true`
- **Resolver**: `eslint-import-resolver-typescript` (replaces the Node resolver)
- **Plugins**: `@typescript-eslint`
- **Rule sets**: `typescript-eslint/recommended` + `recommended-requiring-type-checking`

## Naming conventions enforced

| Selector                       | Convention             |
| ------------------------------ | ---------------------- |
| Interfaces                     | `I` prefix, PascalCase |
| Type aliases                   | `T` prefix, PascalCase |
| Enums                          | `E` prefix, PascalCase |
| Enum members                   | UPPER_CASE             |
| Classes                        | PascalCase             |
| Static class properties        | UPPER_CASE             |
| Methods, functions, parameters | camelCase              |
