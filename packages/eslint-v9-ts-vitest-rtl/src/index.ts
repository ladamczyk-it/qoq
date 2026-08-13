import { baseConfig as jsBaseConfig } from '@ladamczyk/qoq-eslint-v9-js';
import { vitestLayer } from '@ladamczyk/qoq-eslint-v9-js-vitest';
import { rtlLayer } from '@ladamczyk/qoq-eslint-v9-js-vitest-rtl';
import { testLayer, tsLayer } from '@ladamczyk/qoq-eslint-v9-ts';
import { tsVitestLayer } from '@ladamczyk/qoq-eslint-v9-ts-vitest';
import { defineConfig } from 'eslint/config';

import type { Linter } from 'eslint';

/**
 * The delta this package itself contributes. `rtlLayer`'s restoration of
 * testing-library's `prefer-screen-queries` staying off already covers the
 * delta, so there's nothing left to add here beyond naming the config.
 */
export const tsVitestRtlLayer: Linter.Config = {
  name: 'qoq-eslint-v9-ts-vitest-rtl',
};

/**
 * Flat-config array form: the full chain (JS base → vitest layer → RTL layer → ts
 * layer → ts test relaxations → ts-vitest layer → this package's delta), merged per
 * file by ESLint's own cascade instead of being pre-merged.
 * `rtlLayer` sits before the TS layers so TS-layer decisions win, matching the legacy
 * merge order. Composed from delta layers only — never from another package's
 * `configs.*`, which would re-apply the JS base mid-chain and clobber the earlier
 * layers' sonarjs restorations.
 */
export const configs: Record<'base', Linter.Config[]> = {
  base: defineConfig(
    jsBaseConfig,
    vitestLayer,
    rtlLayer,
    tsLayer,
    testLayer,
    tsVitestLayer,
    tsVitestRtlLayer
  ),
};
