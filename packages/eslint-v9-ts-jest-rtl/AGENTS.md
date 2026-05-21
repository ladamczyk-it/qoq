# @saashub/qoq-eslint-v9-ts-jest-rtl — Agent Context

ESLint flat config template for TypeScript test files using Jest + React Testing Library. Extends `@saashub/qoq-eslint-v9-ts-jest`.

## Exports

- `baseConfig` — TS + Jest + RTL config

## Usage

Typically consumed via `qoq.config.js` using the `template` field, scoped to test file patterns. For manual use:

```js
import { baseConfig } from '@saashub/qoq-eslint-v9-ts-jest-rtl';

export default [baseConfig];
```

## Inheritance

Extends TS-Jest base (TypeScript parser + Jest plugin) and adds `eslint-plugin-testing-library` (`flat/react` config).
