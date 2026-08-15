import reactPlugin from '@eslint-react/eslint-plugin';
import { EslintLayer, jsLayer } from '@ladamczyk/qoq-eslint-v9-js';
import { reactLayer } from '@ladamczyk/qoq-eslint-v9-js-react';
import { tsLayer } from '@ladamczyk/qoq-eslint-v9-ts';
import { defineConfig } from 'eslint/config';

import type { Linter } from 'eslint';

/**
 * The delta this package itself contributes. Under `defineConfig` composition,
 * `tsLayer` is a true delta that never carries the JS base's disabled React-only
 * sonarjs rules, so `reactLayer`'s restorations (and its `@eslint-react/no-multi-comp`
 * enable) are never clobbered — neither needs to be re-applied here. Only the
 * `recommended-typescript` rules are genuinely this package's own.
 */
export const tsReactLayer: EslintLayer = {
  name: 'qoq-eslint-v9-ts-react',
  // `?? {}` because upstream types `rules` as optional; `Linter.Config` accepts the
  // resulting `Partial<Linter.RulesRecord>` as-is, so no cast is needed here.
  rules: reactPlugin.configs['recommended-typescript'].rules ?? {},
};

/**
 * Flat-config array form: the full chain (JS base → React layer → ts layer →
 * this package's delta), merged per file by ESLint's own cascade instead of being
 * pre-merged. Composed from delta layers only — a nested
 * `configs.*` would re-apply the JS base mid-chain and clobber `reactLayer`'s
 * sonarjs restorations. `testLayer` is deliberately absent: this bundle is the
 * base delta chain only, not the test-file relaxations.
 */
export const configs: Record<'base', Linter.Config[]> = {
  base: defineConfig(jsLayer, reactLayer, tsLayer, tsReactLayer),
};
