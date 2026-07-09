# @ladamczyk/qoq-eslint-v9-js-react

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/ladamczyk-it/qoq/main.yml) ![NPM Version](https://img.shields.io/npm/v/%40ladamczyk%2Fqoq-eslint-v9-js-react)
![NPM Type Definitions](https://img.shields.io/npm/types/%40ladamczyk%2Fqoq-eslint-v9-js-react) ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ladamczyk%2Fqoq-eslint-v9-js-react) ![NPM License](https://img.shields.io/npm/l/%40ladamczyk%2Fqoq-eslint-v9-js-react)

## Rationale

Tired of setting up [ESLint](https://www.npmjs.com/package/eslint) from scratch for every new project? With the introduction of [Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files) in ESLint v9, we created a set of base templates for different setups. Check out all our [@ladamczyk/qoq-eslint-v9-\* packages](https://www.npmjs.com/search?q=%40ladamczyk%2Fqoq-eslint-v9-).

These configurations inherit from base presets and include all necessary packages and settings. The rules are opinionated, shaped by years of development experience, and can be used as a complete setup or as a foundation for your own configurations.

## Install

    npm install @ladamczyk/qoq-eslint-v9-js-react

## Usage

This package ships **ESM only** (its React plugin dependencies are ESM-only). Import the named `baseConfig` export in your ESLint flat config — use `eslint.config.js` in an ESM project (`"type": "module"`) or `eslint.config.mjs` otherwise.

```js
import { baseConfig } from '@ladamczyk/qoq-eslint-v9-js-react';

export default [
  {
    ...baseConfig,
    files: [...]
  }
];
```

## Rules preview with ESLint Config Inspector

To preview all rules defined by this config simply run:

    npx -y @ladamczyk/qoq-eslint-v9-js-react

### Last but not least

_Feel free to join us, please read [General Contributing Guidelines](https://github.com/ladamczyk-it/qoq/blob/master/.github/CONTRIBUTING.md)_

CLI technical documentation can be found [here](../cli/docs/PROJECT.md)
