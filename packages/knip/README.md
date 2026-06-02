# @ladamczyk/qoq-knip

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/ladamczyk-it/qoq/main.yml) ![NPM Version](https://img.shields.io/npm/v/%40ladamczyk%2Fqoq-knip)
![NPM Type Definitions](https://img.shields.io/npm/types/%40ladamczyk%2Fqoq-knip) ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ladamczyk%2Fqoq-knip) ![NPM License](https://img.shields.io/npm/l/%40ladamczyk%2Fqoq-knip)

## Rationale

Tired of setting up [Knip](https://www.npmjs.com/package/knip) from scratch for every new project? We created a base template to simplify the process.

The configuration is opinionated, shaped by years of development experience, and can be used as a complete setup without any tweaks or as a foundation for your own configurations.

## Install

    npm install @ladamczyk/qoq-knip

## Usage

Package exports both CommonJS and ESM code just import it in Your knip config file.

### For CommonJS

```js
const { jsConfig, jsReactConfig, tsConfig, tsReactConfig } = require('@ladamczyk/qoq-knip');

module.exports = jsConfig;
```

### For ESM

```js
import { jsConfig, jsReactConfig, tsConfig, tsReactConfig } from '@ladamczyk/qoq-knip';

export default jsConfig;
```

### Last but not least

_Feel free to join us, please read [General Contributing Guidelines](https://github.com/ladamczyk-it/qoq/blob/master/.github/CONTRIBUTING.md)_
