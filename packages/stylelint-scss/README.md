# @ladamczyk/qoq-stylelint-scss

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/ladamczyk-it/qoq/main.yml) ![NPM Version](https://img.shields.io/npm/v/%40ladamczyk%2Fqoq-stylelint-scss)
![NPM Type Definitions](https://img.shields.io/npm/types/%40ladamczyk%2Fqoq-stylelint-scss) ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ladamczyk%2Fqoq-stylelint-scss) ![NPM License](https://img.shields.io/npm/l/%40ladamczyk%2Fqoq-stylelint-scss)

## Install

    npm install @ladamczyk/qoq-stylelint-scss

## Usage

Package exports both CommonJS and ESM code, just import it in Your Stylelint config file.

### For CommonJS

```js
const { baseConfig } = require('@ladamczyk/qoq-stylelint-scss');

module.exports = baseConfig;
```

### For ESM

```js
import { baseConfig } from '@ladamczyk/qoq-stylelint-scss';

export default baseConfig;
```

### Last but not least

_Feel free to join us, please read [General Contributing Guidelines](https://github.com/ladamczyk-it/qoq/blob/master/.github/CONTRIBUTING.md)_
