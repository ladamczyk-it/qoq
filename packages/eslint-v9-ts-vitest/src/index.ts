import { EslintLayer, jsLayer } from '@ladamczyk/qoq-eslint-v9-js';
import { vitestLayer } from '@ladamczyk/qoq-eslint-v9-js-vitest';
import { testLayer, tsLayer } from '@ladamczyk/qoq-eslint-v9-ts';
import { defineConfig } from 'eslint/config';

import type { Linter } from 'eslint';

/**
 * The delta this package itself contributes. Under `defineConfig` composition the
 * legacy pre-merge re-restoration hack disappears: the ts layers are true deltas that
 * never carry the JS base's disabled test rules, so the vitest layer's restorations
 * are never clobbered and only the vitest typecheck setting is left to add.
 */
export const tsVitestLayer: EslintLayer = {
  name: 'qoq-eslint-v9-ts-vitest',
  settings: {
    vitest: {
      typecheck: true,
    },
  },
};

/**
 * Flat-config array form: the full chain (JS base → vitest layer → ts layer →
 * ts test relaxations → this package's delta), merged per file by ESLint's own
 * cascade instead of being pre-merged. The JS-only vitest
 * relaxations from eslint-v9-js-vitest are deliberately absent — they don't apply
 * under typed linting.
 */
export const configs: Record<'base', Linter.Config[]> = {
  base: defineConfig(jsLayer, vitestLayer, tsLayer, testLayer, tsVitestLayer),
};
