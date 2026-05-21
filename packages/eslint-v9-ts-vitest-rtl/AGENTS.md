# @saashub/qoq-eslint-v9-ts-vitest-rtl — Agent Context

ESLint flat config template for TypeScript test files using Vitest + React Testing Library. Extends `@saashub/qoq-eslint-v9-ts-vitest`.

## Exports

- `baseConfig` — TS + Vitest + RTL config

## Usage

Typically consumed via `qoq.config.js` using the `template` field, scoped to test file patterns. For manual use:

```js
import { baseConfig } from '@saashub/qoq-eslint-v9-ts-vitest-rtl';

export default [baseConfig];
```

## Inheritance

Extends TS-Vitest base (TypeScript parser + Vitest plugin) and adds `eslint-plugin-testing-library` (`flat/react` config).
