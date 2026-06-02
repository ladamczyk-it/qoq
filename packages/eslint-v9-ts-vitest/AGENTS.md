# @ladamczyk/qoq-eslint-v9-ts-vitest — Agent Context

ESLint flat config template for TypeScript test files using Vitest. Merges `@ladamczyk/qoq-eslint-v9-js-vitest` and `@ladamczyk/qoq-eslint-v9-ts` (testConfig variant).

## Exports

- `baseConfig` — TS + Vitest config

## Usage

Typically consumed via `qoq.config.js` using the `template` field, scoped to test file patterns. For manual use:

```js
import { baseConfig } from '@ladamczyk/qoq-eslint-v9-ts-vitest';

export default [baseConfig];
```

## Inheritance

Combines JS-Vitest base (Vitest plugin + globals) with the TS `testConfig` (TypeScript parser + relaxed unsafe rules).
