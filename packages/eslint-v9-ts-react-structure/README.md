# @ladamczyk/qoq-eslint-v9-ts-react-structure

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/ladamczyk-it/qoq/main.yml) ![NPM Version](https://img.shields.io/npm/v/%40ladamczyk%2Fqoq-eslint-v9-ts-react-structure)
![NPM Type Definitions](https://img.shields.io/npm/types/%40ladamczyk%2Fqoq-eslint-v9-ts-react-structure) ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ladamczyk%2Fqoq-eslint-v9-ts-react-structure) ![NPM License](https://img.shields.io/npm/l/%40ladamczyk%2Fqoq-eslint-v9-ts-react-structure)

## Rationale

A folder/file structure preset for TypeScript + React projects, built on [`eslint-plugin-project-structure`](https://github.com/Igorkowalski94/eslint-plugin-project-structure). It encodes a feature-sliced layout (`components`, `features`, `helpers`, `config`, `store`, `services`) with sensible casing conventions, so structure review is automated rather than manual. Check out all our [@ladamczyk/qoq-eslint-v9-\* packages](https://www.npmjs.com/search?q=%40ladamczyk%2Fqoq-eslint-v9-).

The preset is opinionated yet intentionally permissive — it validates the folder taxonomy and naming without forcing strict folder-name inheritance, so it can be adopted on an existing codebase without a wall of errors, then tightened over time.

## Install

    npm install @ladamczyk/qoq-eslint-v9-ts-react-structure

## Usage

This is a **standalone** config block — apply it separately from your linting template, because it uses the project-structure parser instead of the TypeScript parser.

Package exports both CommonJS and ESM code, just import it in Your eslint config file.

### For CommonJS

```js
const { baseConfig } = require('@ladamczyk/qoq-eslint-v9-ts-react-structure');

module.exports = [
  {
    ...baseConfig,
    files: ['src/**/*.{ts,tsx}'],
  },
];
```

### For ESM

```js
import { baseConfig } from '@ladamczyk/qoq-eslint-v9-ts-react-structure';

export default [
  {
    ...baseConfig,
    files: ['src/**/*.{ts,tsx}'],
  },
];
```

## Rules preview with ESLint Config Inspector

To preview all rules defined by this config simply run:

    npx -y @ladamczyk/qoq-eslint-v9-ts-react-structure

### Last but not least

_Feel free to join us, please read [General Contributing Guidelines](https://github.com/ladamczyk-it/qoq/blob/master/.github/CONTRIBUTING.md)_

CLI technical documentation can be found [here](../eslint-v9/PROJECT.md)
