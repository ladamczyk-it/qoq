# @ladamczyk/qoq-eslint-v9-js-jest — Agent Context

ESLint flat config template for JavaScript test files using Jest. Extends `@ladamczyk/qoq-eslint-v9-js`.

## Exports

- `baseConfig` — JS + Jest config
- `disabledRules` — rules disabled for test files (re-exported for TS-Jest to reuse)

## Usage

Typically consumed via `qoq.config.js` using the `template` field, scoped to test file patterns. For manual use:

```js
import { baseConfig } from '@ladamczyk/qoq-eslint-v9-js-jest';

export default [baseConfig];
```

## Added on top of the JS base

- **Plugin**: `eslint-plugin-jest` (recommended rules)
- Jest globals injected into `languageOptions`
- `sonarjs/no-duplicate-string` disabled (common in test fixtures)
