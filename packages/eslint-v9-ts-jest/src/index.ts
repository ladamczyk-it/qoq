import {
  EslintConfig,
  TEST_ONLY_SONARJS_RULES,
  baseConfig as jsBaseConfig,
  restoreSonarjsRules,
} from '@ladamczyk/qoq-eslint-v9-js';
import {
  baseConfig as jsJestBaseConfig,
  disabledRules,
  jestLayer,
} from '@ladamczyk/qoq-eslint-v9-js-jest';
import { testConfig as tsTestConfig, testLayer, tsLayer } from '@ladamczyk/qoq-eslint-v9-ts';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import { defineConfig } from 'eslint/config';

import type { Linter } from 'eslint';

const { plugins: jsJestBaseConfigPlugins, ...jsJestBaseConfigRest } = jsJestBaseConfig;
const { plugins: tsTestConfigPlugins, ...tsTestConfigRest } = tsTestConfig;

// tsTestConfigRest is merged in after jsJestBaseConfigRest and still carries the
// test rules disabled (it's built from eslint-v9-js, not eslint-v9-js-jest), so its
// "off" wins the objectMergeRight merge unless re-restored here as the final override.
const restoredTestRules = restoreSonarjsRules(TEST_ONLY_SONARJS_RULES);

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsJestBaseConfigRest, tsTestConfigRest, {
    name: 'qoq-eslint-v9-ts-jest',
    rules: {
      ...restoredTestRules,
      ...disabledRules,
    },
  }),
  plugins: { ...jsJestBaseConfigPlugins, ...tsTestConfigPlugins },
};

/**
 * The delta this package itself contributes. Under `defineConfig` composition the
 * legacy re-restoration hack above disappears: the ts layers are true deltas that
 * never carry the JS base's disabled test rules, so the jest layer's restorations
 * (`restoredTestRules` and `disabledRules`, both already baked into `jestLayer`) are
 * never clobbered and nothing is left for this package to re-add.
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
