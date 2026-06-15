# @ladamczyk/qoq-eslint-v9-ts-react — Agent Context

ESLint flat config template for TypeScript + React projects. Merges `@ladamczyk/qoq-eslint-v9-js-react` and `@ladamczyk/qoq-eslint-v9-ts`.

## Exports

- `baseConfig` — TS + React config

## Usage

Typically consumed via `qoq.config.js` using the `template` field. For manual use:

```js
import { baseConfig } from '@ladamczyk/qoq-eslint-v9-ts-react';

export default [baseConfig];
```

## Inheritance

Merges JS-React base (plugins: `@eslint-react`, `@stylistic`, `compat`, `react-refresh`) with the TS base (TypeScript parser + `@typescript-eslint` rules). Uses `@eslint-react/recommended-typescript` rules on top of both. The custom `@eslint-react/no-multi-comp` rule (defined in `eslint-v9-js-react`) is inherited via the JS-React base and re-asserted here so it survives the `recommended-typescript` merge. The Fast-Refresh rule `react-refresh/only-export-components` is likewise inherited from the JS-React base (plugin and rule both flow through the base spread; no re-assertion needed since `recommended-typescript` doesn't touch that namespace).
