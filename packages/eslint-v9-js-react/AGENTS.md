# @saashub/qoq-eslint-v9-js-react — Agent Context

ESLint flat config template for JavaScript + React projects. Extends `@saashub/qoq-eslint-v9-js`.

## Exports

- `baseConfig` — JS + React config
- `disabledRules` — stylistic rules disabled for React (re-exported for TS-React to reuse)

## Usage

Typically consumed via `qoq.config.js` using the `template` field. For manual use:

```js
import { baseConfig } from '@saashub/qoq-eslint-v9-js-react';

export default [baseConfig];
```

## Added on top of the JS base

- **Plugins**: `@eslint-react`, `@stylistic`, `eslint-plugin-compat`
- `ecmaFeatures.jsx: true`
- Import order rule adjusted: `react*` imports are placed before all other groups
- `lodash/debounce` restricted — use `use-debounce` in React projects
- Stylistic formatting rules are disabled (Prettier handles formatting)
