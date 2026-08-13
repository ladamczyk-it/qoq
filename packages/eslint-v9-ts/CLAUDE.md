# CLAUDE.md

Consumer-facing context (exports, naming conventions, added plugins) lives in `AGENTS.md`.

## Commands

```bash
npm run build # Rolldown → ./lib CJS+ESM + ./bin inspector
npm test      # from the repo root — no per-package test script
```

## Internal architecture

`src/index.ts` exports `baseConfig` and `testConfig`. Both are built with `objectMergeRight` over the JS base config. The plugins object is constructed separately (spread pattern) because ESLint flat config requires plugins at the top level, not nested inside merges. `testConfig` is a shallow relaxation of `baseConfig` that disables the four most disruptive TypeScript unsafe rules for test files.
