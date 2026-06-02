# @ladamczyk/qoq-eslint-v9-js-vitest — Agent Context

ESLint flat config template for JavaScript test files using Vitest. Extends `@ladamczyk/qoq-eslint-v9-js`.

## Exports

- `baseConfig` — JS + Vitest config
- `disabledRules` — rules disabled for test files (re-exported for TS-Vitest to reuse)

## Usage

Typically consumed via `qoq.config.js` using the `template` field, scoped to test file patterns. For manual use:

```js
import { baseConfig } from '@ladamczyk/qoq-eslint-v9-js-vitest';

export default [baseConfig];
```

## Added on top of the JS base

- **Plugin**: `@vitest/eslint-plugin` (recommended rules)
- Vitest globals injected into `languageOptions`
- `sonarjs/no-duplicate-string` and `vitest/expect-expect` disabled
