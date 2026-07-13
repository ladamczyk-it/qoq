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

- **Plugin**: `@vitest/eslint-plugin` (recommended rules), plus a hand-picked set
  (`no-duplicate-hooks`, `no-conditional-in-test`, `no-test-return-statement`,
  `no-large-snapshots`, `prefer-strict-equal`, `prefer-to-be`, `no-test-prefixes`,
  `no-conditional-tests`, `prefer-hooks-in-order`, `max-nested-describe`,
  `require-to-throw-message`) not part of vitest's own `recommended` config
- Vitest globals injected into `languageOptions`
- `sonarjs/no-duplicate-string` disabled (common in test fixtures)
- Several `TEST_ONLY_SONARJS_RULES` restored here are disabled again: ones that duplicate
  a `@vitest/eslint-plugin` recommended rule (`no-skipped-tests`, `no-exclusive-tests`,
  `no-duplicate-test-title`, `no-empty-test-title`, `assertions-in-tests`), ones that
  hard-gate on Chai usage a Vitest consumer never has (`disabled-timeout`,
  `chai-determinate-assertion`, `no-same-argument-assert`), and
  `no-incompatible-assertion-types`, which is a hard no-op without a typed-linting
  parser (this package has none — `eslint-v9-ts-vitest` re-enables it, since it does)
