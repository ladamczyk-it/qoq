import { EslintConfig, baseConfig as jsBaseConfig } from '@ladamczyk/qoq-eslint-v9-js';
import { vitestLayer } from '@ladamczyk/qoq-eslint-v9-js-vitest';
import {
  baseConfig as jsVitestRtlBaseConfig,
  disabledRules,
  rtlLayer,
} from '@ladamczyk/qoq-eslint-v9-js-vitest-rtl';
import { testLayer, tsLayer } from '@ladamczyk/qoq-eslint-v9-ts';
import { baseConfig as tsBaseConfig, tsVitestLayer } from '@ladamczyk/qoq-eslint-v9-ts-vitest';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import { defineConfig } from 'eslint/config';

import type { Linter } from 'eslint';

const { plugins: jsVitestRtlBaseConfigPlugins, ...jsVitestRtlBaseConfigRest } =
  jsVitestRtlBaseConfig;
const { plugins: tsBaseConfigPlugins, ...tsBaseConfigRest } = tsBaseConfig;

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsVitestRtlBaseConfigRest, tsBaseConfigRest, {
    name: 'qoq-eslint-v9-ts-vitest-rtl',
    rules: { ...disabledRules },
  }),
  plugins: { ...jsVitestRtlBaseConfigPlugins, ...tsBaseConfigPlugins },
};

/**
 * The delta this package itself contributes. `disabledRules` (testing-library's
 * `prefer-screen-queries` staying off) is already carried by `rtlLayer`, so there's
 * nothing left to add here beyond naming the config.
 */
export const tsVitestRtlLayer: Linter.Config = {
  name: 'qoq-eslint-v9-ts-vitest-rtl',
};

/**
 * Flat-config array form: the full chain (JS base → vitest layer → RTL layer → ts
 * layer → ts test relaxations → ts-vitest layer → this package's delta), merged per
 * file by ESLint's own cascade instead of being pre-merged with `objectMergeRight`.
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
