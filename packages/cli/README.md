# @ladamczyk/qoq-cli

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/ladamczyk-it/qoq/main.yml) ![NPM Version](https://img.shields.io/npm/v/%40ladamczyk%2Fqoq-cli)
![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ladamczyk%2Fqoq-cli) ![NPM License](https://img.shields.io/npm/l/%40ladamczyk%2Fqoq-cli)

## Rationale

To maintain high code quality and simplify the use of static code analysis tools in both CI and Git hooks, we created **QoQ CLI**. It orchestrates multiple tools with minimal configuration, allowing you to run everything you need with just three simple commands:

- `qoq --check` – Runs a full code check, typically used in the CI lint step or pre-push hook.
- `qoq staged` – Checks only staged changes, typically used in the pre-commit hook.
- `qoq --fix` – Fixes issues where possible, typically triggered manually after hooks or a CI failure to quickly correct problems.

With **QoQ CLI**, keeping your code clean and compliant is easier than ever.

## Orchestrated checks

**Default checks** run on every command and need no configuration. Each can be skipped for a single run with its `--skip-*` flag:

- **npm packages check** – flags outdated dependencies via `npm outdated`, throttled to `npm.checkOutdatedEvery` days (`--skip-npm`).
- **Prettier** formatting (`--skip-prettier`), **JSCPD** copy-paste detection (`--skip-jscpd`), **Knip** unused-exports/dead-code (`--skip-knip`), and **ESLint** linting (`--skip-eslint`).

**Optional checks** run only when their config block is present in `qoq.config.js`; omit the block to disable them (there is no `--skip-*` flag for these):

- **Stylelint** – CSS/SCSS linting, backed by the compliant `@ladamczyk/qoq-stylelint-css` or `@ladamczyk/qoq-stylelint-scss` template. Enabled via a `stylelint` block.
- **Skillslint** – lints Claude Code skill documentation, backed by `@ladamczyk/skillslint`. Enabled via a `skillslint` block.

## Install

    npm install @ladamczyk/qoq-cli

or run wizard directly via npx with

    npx -y @ladamczyk/qoq-cli --init

## Usage

First of all, if not configured via npx we need to run wizard manually, You can do it intentionally by running:

    qoq --init

But if no config file found, it will ask to create one every time You'll run check or fix. It supports monorepo without adding anything, based on `package.json` entry `workspaces`.

## Automatic configuration

Simply answer all the questions, and the wizard will generate initial configuration values for you. Once complete, it will install all necessary packages from the [@ladamczyk/qoq-\*](https://www.npmjs.com/search?q=%40ladamczyk%2Fqoq-) workspace and create three files in your project's root directory:

- `.prettierrc` – Supports IDE formatting with a pre-configured template.
- `eslint.config.js` – Connects the CLI-generated ESLint config with your IDE.
- `qoq.config.js` – Provides configuration for the CLI.

With this setup, you’ll be up and running quickly with minimal manual configuration.

## Manual configuration

When setting things up by yourself all three files needs to be created manually,

1. `.prettierrc` with custom config or QoQ templeate eg `"@ladamczyk/qoq-prettier"`
2. `eslint.config.js` with custom config or re-export of QoQ settings in CommonJs

   ```js
   const config = require('@ladamczyk/qoq-cli/bin/eslint.config.cjs');

   module.exports = config;
   ```

   or ESM

   ```js
   import config from '@ladamczyk/qoq-cli/bin/eslint.config.mjs';

   export default config;
   ```

3. `qoq.config.js` with config only for QoQ CLI, params described below

## Important notice to ESLint config

Since QoQ CLI re-creates config for the particular tool on execution You may end up with a situation that created `eslint.config.js` config will try to import a file that doesn't exist yet. The same situation will occur when You checkout a fresh project and install dependencies. To avoid that please modify Your `package.json` file in `scripts` section by adding:

    "postinstall": "qoq --warmup"

We're not adding it to the package on purpose. Often 3rd party libraries with `postinstall` scripts are treated as suspicious due to the fact that You can execute there pretty much everything. Also `pnpm` totally ignores `postinstalls` entry.

## Configuration object in qoq.config.js

Needs to export an CommonJS or ESM [configuration object](./docs/CONFIG.md).

## Available options

CLI has its own documentation just run `qoq -help` or `qoq -h`.

### Last but not least

_Feel free to join us, please read [General Contributing Guidelines](https://github.com/ladamczyk-it/qoq/blob/master/.github/CONTRIBUTING.md)_

CLI technical documentation can be found [here](./docs/PROJECT.md)
