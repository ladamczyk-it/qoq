# @ladamczyk/qoq-prettier-with-json-sort

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/ladamczyk-it/qoq/main.yml) ![NPM Version](https://img.shields.io/npm/v/%40ladamczyk%2Fqoq-eslint-v9-ts-vitest)
![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ladamczyk%2Fqoq-eslint-v9-ts-vitest) ![NPM License](https://img.shields.io/npm/l/%40ladamczyk%2Fqoq-eslint-v9-ts-vitest)

## Rationale

Tired of setting up [Prettier](https://www.npmjs.com/package/prettier) from scratch for every new project? We created a base template to streamline the process.

## Install

    npm install @ladamczyk/qoq-prettier-with-json-sort

## Usage

You can simply put `"@ladamczyk/qoq-prettier-with-json-sort"` in Your `.prettierrc` file. or use it as a template:

### For CommonJS

```js
const config = require('@ladamczyk/qoq-prettier-with-json-sort/config').default;

module.exports = {
  ...config,
};
```

### For ESM

```js
import config from '@ladamczyk/qoq-prettier-with-json-sort/config';

export default {
  ...config,
};
```

### Last but not least

_Feel free to join us, please read [General Contributing Guidelines](https://github.com/ladamczyk-it/qoq/blob/master/.github/CONTRIBUTING.md)_
