# @ladamczyk/qoq-prettier

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/ladamczyk-it/qoq/main.yml) [![codecov](https://codecov.io/gh/ladamczyk-it/qoq/graph/badge.svg?flag=prettier&token=PQ1XAQQ257)](https://codecov.io/gh/ladamczyk-it/qoq/flags/prettier) ![NPM Version](https://img.shields.io/npm/v/%40ladamczyk%2Fqoq-eslint-v9-ts-vitest)
![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ladamczyk%2Fqoq-eslint-v9-ts-vitest) ![NPM License](https://img.shields.io/npm/l/%40ladamczyk%2Fqoq-eslint-v9-ts-vitest)

## Rationale

Tired of setting up [Prettier](https://www.npmjs.com/package/prettier) from scratch for every new project? We created a base template to make the process easier.

## Install

    npm install @ladamczyk/qoq-prettier

## Usage

You can simply put `"@ladamczyk/qoq-prettier"` in Your `.prettierrc` file. or use it as a template:

### For CommonJS

```js
const config = require('@ladamczyk/qoq-prettier/config').default;

module.exports = {
  ...config,
};
```

### For ESM

```js
import config from '@ladamczyk/qoq-prettier/config';

export default {
  ...config,
};
```

### Last but not least

_Feel free to join us, please read [General Contributing Guidelines](https://github.com/ladamczyk-it/qoq/blob/master/.github/CONTRIBUTING.md)_
