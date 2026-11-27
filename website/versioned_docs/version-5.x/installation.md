---
sidebar_position: 2
title: Installation | v5.x
sidebar_label: Installation | v5.x
description: 'Install the QoQ 5.x CLI, run the Config Wizard, and wire the generated ESLint, Prettier and Stylelint configs into your IDE. | v5.x'
---

Install the CLI as a dev dependency:

```bash
npm install --save-dev @ladamczyk/qoq-cli@5
```

Then run the **Config Wizard**, which installs the matching `@ladamczyk/qoq-*` presets and writes the config files:

```bash
npx -y @ladamczyk/qoq-cli@5 --init
```

## Generated files

- `.prettierrc` — the Prettier template, for IDE formatting.
- `eslint.config.js` — connects the CLI-generated ESLint config with your IDE.
- `stylelint.config.js` — only when you enable Stylelint.
- `qoq.config.js` — the CLI's own [configuration](./configuration.md).

## Manual setup

```js
import config from '@ladamczyk/qoq-cli/bin/eslint.config.mjs';

export default config;
```

CommonJS uses `require('@ladamczyk/qoq-cli/bin/eslint.config.cjs')`; Stylelint uses `bin/stylelint.config.{cjs,mjs}`.

## Warmup

Add `"postinstall": "qoq --warmup"` to your `scripts` so `eslint.config.js` has a generated config to import on a fresh checkout. From **5.3.1**, `--warmup` never launches the wizard.

## Skill

The `qoq` skill installs from the same repository, through the plugin marketplace or a skills installer:

```text
/plugin marketplace add ladamczyk-it/qoq
/plugin install qoq@qoq-agent-skills
```

```bash
npx skills add ladamczyk-it/qoq --skill qoq
```

See [The qoq skill](./skill.md).
