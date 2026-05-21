# @saashub/qoq-eslint-v9-ts-jest — Agent Context

ESLint flat config template for TypeScript test files using Jest. Merges `@saashub/qoq-eslint-v9-js-jest` and `@saashub/qoq-eslint-v9-ts` (testConfig variant).

## Exports

- `baseConfig` — TS + Jest config

## Usage

Typically consumed via `qoq.config.js` using the `template` field, scoped to test file patterns. For manual use:

```js
import { baseConfig } from '@saashub/qoq-eslint-v9-ts-jest';

export default [baseConfig];
```

## Inheritance

Combines JS-Jest base (Jest plugin + globals) with the TS `testConfig` (TypeScript parser + relaxed unsafe rules). Uses `disabledRules` from JS-Jest on top.
