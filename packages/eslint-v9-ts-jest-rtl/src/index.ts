import { EslintConfig, baseConfig as jsBaseConfig } from '@ladamczyk/qoq-eslint-v9-js';
import { jestLayer } from '@ladamczyk/qoq-eslint-v9-js-jest';
import {
  baseConfig as jsJestBaseConfig,
  disabledRules,
  rtlLayer,
} from '@ladamczyk/qoq-eslint-v9-js-jest-rtl';
import { testLayer, tsLayer } from '@ladamczyk/qoq-eslint-v9-ts';
import { baseConfig as tsBaseConfig, tsJestLayer } from '@ladamczyk/qoq-eslint-v9-ts-jest';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import { defineConfig } from 'eslint/config';

import type { Linter } from 'eslint';

const { plugins: jsJestRtlBaseConfigPlugins, ...jsJestRtlBaseConfigRest } = jsJestBaseConfig;
const { plugins: tsBaseConfigPlugins, ...tsBaseConfigRest } = tsBaseConfig;

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsJestRtlBaseConfigRest, tsBaseConfigRest, {
    name: 'qoq-eslint-v9-ts-jest-rtl',
    rules: { ...disabledRules },
  }),
  plugins: { ...jsJestRtlBaseConfigPlugins, ...tsBaseConfigPlugins },
};

/**
 * The delta this package itself contributes. Under `defineConfig` composition the
 * legacy re-restoration hack above disappears: `rtlLayer` is a true delta that never
 * carries the JS base's disabled rules, so its `disabledRules` restoration is never
 * clobbered and nothing is left for this package to re-add.
 */
export const tsJestRtlLayer: Linter.Config = {
  name: 'qoq-eslint-v9-ts-jest-rtl',
};

/**
 * Flat-config array form: the full chain (JS base → jest layer → RTL layer → ts layer →
 * ts test relaxations → ts-jest layer → this package's delta), merged per file by
 * ESLint's own cascade instead of being pre-merged with `objectMergeRight`. `rtlLayer`
 * sits before the TS layers so TS-layer decisions still win, matching the legacy merge
 * order. Composed from delta layers only (never from another package's `configs.*`),
 * which would re-apply the JS base mid-chain and clobber the earlier layers' sonarjs
 * restorations. The JS-only `sonarjs/no-incompatible-assertion-types` disable that
 * eslint-v9-js-jest-rtl appends to its own chain is deliberately absent here — this
 * package has type information, so that rule stays enabled.
 */
export const configs: Record<'base', Linter.Config[]> = {
  base: defineConfig(
    jsBaseConfig,
    jestLayer,
    rtlLayer,
    tsLayer,
    testLayer,
    tsJestLayer,
    tsJestRtlLayer
  ),
};
