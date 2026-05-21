# @saashub/qoq-stylelint-css — Agent Context

Stylelint configuration template for CSS projects. All other `@saashub/qoq-stylelint-*` packages extend this one.

## Exports

- `baseConfig` — Stylelint config object, ready to use or extend

## Usage

Typically consumed via `qoq.config.js` using the `template` field (handled by `@saashub/qoq-cli`). For manual use:

```js
import { baseConfig } from '@saashub/qoq-stylelint-css';

export default baseConfig;
```

## Included rule sets & plugins

| Source                                      | Purpose                                               |
| ------------------------------------------- | ----------------------------------------------------- |
| `stylelint-config-standard`                 | Standard CSS rules                                    |
| `stylelint-config-clean-order`              | Property declaration ordering                         |
| `stylelint-prettier`                        | Prettier as a Stylelint rule                          |
| `stylelint-file-max-lines`                  | Max 600 lines per file                                |
| `stylelint-high-performance-animation`      | Warns on low-performance animation properties         |
| `stylelint-no-unsupported-browser-features` | Warns on unsupported CSS features (severity: warning) |
