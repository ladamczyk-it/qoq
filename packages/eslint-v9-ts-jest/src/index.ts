import { baseConfig as jsBaseConfig } from '@ladamczyk/qoq-eslint-v9-js';
import { jestLayer } from '@ladamczyk/qoq-eslint-v9-js-jest';
import { testLayer, tsLayer } from '@ladamczyk/qoq-eslint-v9-ts';
import { defineConfig } from 'eslint/config';

import type { Linter } from 'eslint';

/**
 * The delta this package itself contributes. Under `defineConfig` composition the
 * legacy pre-merge re-restoration hack disappears: the ts layers are true deltas
 * that never carry the JS base's disabled test rules, so the jest layer's own
 * restorations (already baked into `jestLayer`) are never clobbered and nothing
 * is left for this package to re-add.
 */
export const tsJestLayer: Linter.Config = {
  name: 'qoq-eslint-v9-ts-jest',
};

/**
 * Flat-config array form: the full chain (JS base → jest layer → ts layer →
 * ts test relaxations → this package's delta), merged per file by ESLint's own
 * cascade instead of being pre-merged with `objectMergeRight`. The JS-only
 * `sonarjs/no-incompatible-assertion-types` disable that eslint-v9-js-jest appends
 * to its own `baseConfig`/`configs.base` is deliberately absent here — this package
 * has type information, so that rule stays enabled.
 */
export const configs: Record<'base', Linter.Config[]> = {
  base: defineConfig(jsBaseConfig, jestLayer, tsLayer, testLayer, tsJestLayer),
};
