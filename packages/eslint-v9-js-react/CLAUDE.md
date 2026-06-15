# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exports, plugins, import order rule) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-js-react/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib ESM-only + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` builds `baseConfig` and `disabledRules` (exported for reuse by `eslint-v9-ts-react`). The import order rule and no-restricted-imports rule are patched versions of the JS base rules — they are reconstructed by spreading the original rule config and adding React-specific entries.

`src/rules/no-multi-comp.ts` holds the custom `no-multi-comp` rule (re-exported from `index.ts` via `export *`). It is a plain `Rule.RuleModule` whose component detection is delegated to `@eslint-react/core`'s `getFunctionComponentCollector` — the same machinery `@eslint-react/eslint-plugin` uses — rather than re-implementing detection like `react/no-multi-comp`. Legacy class components are intentionally not supported. The collector's `visitor` is run during traversal and merged with our own `Program:exit` (a small `mergeListeners` helper composes listeners that share a selector); at exit we call `api.getAllComponents(program)`, sort by source position, and report every component after the first. The rule takes no options. `@eslint-react/core` is ESM-only (like `@eslint-react/eslint-plugin` and `eslint-plugin-react-refresh`), which is why this package — and `eslint-v9-ts-react` — ship **ESM-only** (`./lib/index.mjs`, no CJS output): Rollup externalizes deps, and an externalized `require()` of an `import`-only package can't resolve (`ERR_PACKAGE_PATH_NOT_EXPORTED`). The React Rollup configs override the shared one to drop the CJS output; the `exports` map exposes only the `import` condition.

To enable the rule under the `@eslint-react/` prefix without mutating the shared plugin singleton, `index.ts` builds `reactPluginWithCustomRules` — a shallow copy of `reactPlugin` with the custom rule merged into its `rules` map — and registers _that_ as the `@eslint-react` plugin.
