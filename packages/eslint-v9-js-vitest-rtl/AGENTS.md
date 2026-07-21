# @ladamczyk/qoq-eslint-v9-js-vitest-rtl — Agent Context

ESLint flat config template for JavaScript test files using Vitest + React Testing Library. Extends `@ladamczyk/qoq-eslint-v9-js-vitest`.

## Exports

- `baseConfig` — JS + Vitest + RTL config

## Usage

Typically consumed via `qoq.config.js` using the `template` field, scoped to test file patterns. For manual use:

```js
import { baseConfig } from '@ladamczyk/qoq-eslint-v9-js-vitest-rtl';

export default [baseConfig];
```

## Added on top of JS-Vitest

- **Plugin**: `eslint-plugin-testing-library` (`flat/react` config), plus
  `prefer-user-event` (not part of `flat/react`)
- `testing-library/prefer-screen-queries` disabled
