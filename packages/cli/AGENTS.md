# @ladamczyk/qoq-cli — Agent Context

`@ladamczyk/qoq-cli` orchestrates Prettier, ESLint, Knip, JSCPD, Stylelint, Skillslint, and npm-outdated checks behind three commands. It reads `qoq.config.js` from the consumer project root, generates tool-specific config files at runtime into its own `bin/` directory, and delegates to each tool.

## Commands

```bash
qoq --init              # interactive wizard — writes qoq.config.js, eslint.config.js, .prettierrc
qoq --check             # full quality check (CI / pre-push)
qoq staged [files]      # check staged files only (pre-commit / lint-staged)
qoq --fix               # auto-fix across all tools
qoq [tools...]          # run only the named tools, e.g. `qoq eslint prettier`
```

All commands accept these flags:

| Flag                                      | Effect                                                                |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `--disable-cache`                         | Skip caching for all tools                                            |
| `--skip-{prettier,jscpd,knip,eslint,npm}` | Skip individual tools                                                 |
| `--concurrency <off\|auto>`               | Run tools concurrently where possible                                 |
| `--production`                            | Run Knip in production mode                                           |
| `--config-hints`                          | Enable Knip config hints                                              |
| `--silent`                                | Suppress QoQ output                                                   |
| `--warmup`                                | Pre-generate config files without running tools                       |
| `--json`                                  | Write each tool's output to a JSON file in `--output`                 |
| `--output <path>`                         | Directory for JSON reports (default: `bin/report`); requires `--json` |

Add `"postinstall": "qoq --warmup"` to the consumer's `package.json` so IDEs get valid ESLint/Stylelint configs immediately after `npm install`.

## qoq.config.js schema

All fields are optional. Defaults apply when omitted.

```js
export default {
  srcPath: './src', // fallback path used by all tools

  configPaths: {
    // override locations of generated IDE config files
    eslint: '/eslint.config.js',
    prettier: '/.prettierrc',
    stylelint: '/stylelint.config.js',
  },

  npm: {
    checkOutdatedEvery: 1, // days between npm outdated checks; 0 = every run
  },

  prettier: {
    sources: ['./src'], // paths passed to Prettier
  },

  jscpd: {
    threshold: 2, // max duplication % before failure
    format: [], // language formats (see jscpd docs)
    ignore: [],
  },

  knip: {
    entry: [], // defaults to src/{index,cli,main,root}.{ts,js,...}
    project: [], // defaults to src/**/*.{ts,js,...}
    ignore: [],
    ignoreDependencies: [], // '@ladamczyk/qoq-*' is always ignored by default
    ignoreBinaries: [],
  },

  eslint: [
    {
      template: '@ladamczyk/qoq-eslint-v9-ts', // merges baseConfig from this template
      files: ['src/**/*.ts'],
      ignores: ['**/*.spec.ts'],
      rules: {}, // additional ESLint rules
    },
    {
      template: '@ladamczyk/qoq-eslint-v9-ts-vitest',
      files: ['src/**/*.spec.ts'],
    },
  ],

  stylelint: {
    // omit entirely to disable
    template: '@ladamczyk/qoq-stylelint-css', // or '@ladamczyk/qoq-stylelint-scss'
    strict: false, // true = fail on warnings
  },

  skillslint: {
    // omit entirely to disable; lints Claude Code skill docs
    path: './skills',
  },
};
```

Available ESLint `template` values:
`@ladamczyk/qoq-eslint-v9-{js,ts,js-react,ts-react,js-jest,ts-jest,js-jest-rtl,ts-jest-rtl,js-vitest,ts-vitest,js-vitest-rtl,ts-vitest-rtl}`

## Generated files

QoQ writes tool configs into its own `bin/` at runtime — the consumer project only needs the three root files below. Format (CJS vs ESM) is auto-detected from `qoq.config.js`.

**Consumer project root files** (created by `qoq --init`, thin re-exports for IDE support):

- `eslint.config.js` — re-exports `@ladamczyk/qoq-cli/bin/eslint.config.{m,c}js`
- `stylelint.config.js` — re-exports `@ladamczyk/qoq-cli/bin/stylelint.config.{m,c}js`
- `.prettierrc` — points to a `@ladamczyk/qoq-prettier*` template

**Runtime-generated inside `node_modules/@ladamczyk/qoq-cli/bin/`** (do not edit):

| File                           | Notes                                                                  |
| ------------------------------ | ---------------------------------------------------------------------- |
| `eslint.config.{m,c}js`        | Merges `baseConfig` from each template; includes `.gitignore` patterns |
| `knip.config.{m,c}js`          | Monorepo-aware: maps `workspaces` into Knip's workspace config         |
| `stylelint.config.{m,c}js`     | Assembled from the stylelint template                                  |
| `.npm-outdated-lock`           | Timestamp file that throttles npm checks to `checkOutdatedEvery` days  |
| `.<tool>cache`                 | Per-tool cache directories (cleared on `--warmup`)                     |
| `report/eslint-report.json`    | ESLint findings (written when `--json` is passed)                      |
| `report/knip-report.json`      | Knip findings (written when `--json` is passed)                        |
| `report/jscpd-report.json`     | JSCPD JSON output directory (written when `--json` is passed)          |
| `report/prettier-report.json`  | List of files with formatting issues (written when `--json` is passed) |
| `report/stylelint-report.json` | Stylelint findings (written when `--json` is passed)                   |
