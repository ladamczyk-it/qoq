# @ladamczyk/qoq-eslint-v9-js — Agent Context

Base ESLint flat config template for vanilla JavaScript projects. All other `@ladamczyk/qoq-eslint-v9-*` packages extend this one.

## Exports

- `baseConfig` — ESLint flat config object, ready to use or extend
- `EslintConfig` / `EslintConfigPlugin` — TypeScript types for config objects
- `getNoRestrictedImportsPaths(extra?)` — returns `no-restricted-imports` paths array; auto-detects lodash and es-toolkit in the consumer project and adds usage guidance
- `@ladamczyk/qoq-eslint-v9-js/stats` subpath — `getEnabledRuleNames(statsDir)` and `getEnabledDeprecatedRules(statsDir)` read a `@eslint/config-inspector build` payload (a package's `stats/` dir) so a test can fail when the config enables a deprecated rule

## Usage

Typically consumed via `qoq.config.js` using the `template` field (handled by `@ladamczyk/qoq-cli`). For manual use:

```js
import { baseConfig } from '@ladamczyk/qoq-eslint-v9-js';

export default [baseConfig];
```

## Included plugins & key rules

| Plugin                        | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `@eslint/js`                  | JS recommended rules                             |
| `eslint-plugin-import-x`      | Import ordering, cycles, duplicates              |
| `eslint-plugin-prettier`      | Prettier as an ESLint rule                       |
| `eslint-plugin-sonarjs`       | Code quality (cognitive complexity, duplication) |
| `eslint-plugin-file-progress` | Per-file lint progress output                    |

Key limits: max 600 lines per file, max 200 lines per function. Relative imports deeper than one level (`../../*`) are forbidden — use path aliases instead.
