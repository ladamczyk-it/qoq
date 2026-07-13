# @ladamczyk/qoq-eslint-v9-js-jest-rtl — Agent Context

ESLint flat config template for JavaScript test files using Jest + React Testing Library. Extends `@ladamczyk/qoq-eslint-v9-js-jest`.

## Exports

- `baseConfig` — JS + Jest + RTL config

## Usage

Typically consumed via `qoq.config.js` using the `template` field, scoped to test file patterns. For manual use:

```js
import { baseConfig } from '@ladamczyk/qoq-eslint-v9-js-jest-rtl';

export default [baseConfig];
```

## Added on top of JS-Jest

- **Plugin**: `eslint-plugin-testing-library` (`flat/react` config), plus
  `no-test-id-queries` and `prefer-user-event` (not part of `flat/react`)
- `testing-library/prefer-screen-queries` disabled
