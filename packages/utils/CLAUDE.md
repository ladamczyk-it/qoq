# CLAUDE.md

Consumer-facing context (exported functions and their signatures) lives in `AGENTS.md`.

## Commands

```bash
npm run build # Rolldown → ./lib, outputs CJS + ESM
npm test      # from the repo root — no per-package test script
```

## Internal architecture

Four modules exported from `src/index.ts`:

- **`objectMergeRight`** — deep merge using `structuredClone`; walks both objects recursively, right side wins, `undefined` values delete the key from the left side. Used by `StylelintExecutor` to merge a consumer's overrides onto a template's `baseConfig`; the `eslint-v9-*` packages do not consume it — their delta layers are composed into `configs.*` arrays and merged by ESLint's own per-file cascade instead
- **`executeCommand`** — wraps `child_process.spawn` in a Promise; overloaded to return `EExitCode` or captured stdout string depending on `captureOutput`
- **`packages`** — thin wrappers around `local-pkg` (`isPackageExists`, `getPackageInfoSync`, `loadPackageJSONSync`)
- **`paths`** — three helpers that compose `process.cwd()` with `path.resolve` to produce absolute or relative paths
