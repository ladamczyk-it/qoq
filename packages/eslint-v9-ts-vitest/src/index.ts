import {
  EslintConfig,
  TEST_ONLY_SONARJS_RULES,
  baseConfig as jsBaseConfig,
  restoreSonarjsRules,
} from '@ladamczyk/qoq-eslint-v9-js';
import {
  baseConfig as jsVitestBaseConfig,
  disabledRules,
  vitestLayer,
} from '@ladamczyk/qoq-eslint-v9-js-vitest';
import {
  testConfig as tsTestConfig,
  testLayer as tsTestLayer,
  tsLayer,
} from '@ladamczyk/qoq-eslint-v9-ts';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import { defineConfig } from 'eslint/config';

import type { Linter } from 'eslint';

const { plugins: jsVitestBaseConfigPlugins, ...jsVitestBaseConfigRest } = jsVitestBaseConfig;
const { plugins: tsTestConfigPlugins, ...tsTestConfigRest } = tsTestConfig;

// tsTestConfigRest is merged in after jsVitestBaseConfigRest and still carries the
// test rules disabled (it's built from eslint-v9-js, not eslint-v9-js-vitest), so its
// "off" wins the objectMergeRight merge unless re-restored here as the final override.
const restoredTestRules = restoreSonarjsRules(TEST_ONLY_SONARJS_RULES);

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsVitestBaseConfigRest, tsTestConfigRest, {
    name: 'qoq-eslint-v9-ts-vitest',
    rules: { ...restoredTestRules, ...disabledRules },
    settings: {
      vitest: {
        typecheck: true,
      },
    },
  }),
  plugins: { ...jsVitestBaseConfigPlugins, ...tsTestConfigPlugins },
};

/**
 * The delta this package itself contributes. Under `defineConfig` composition the
 * legacy re-restoration hack above disappears: the ts layers are true deltas that
 * never carry the JS base's disabled test rules, so the vitest layer's restorations
 * are never clobbered and only the vitest typecheck setting is left to add.
 */
export const tsVitestLayer: Linter.Config = {
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
 * cascade instead of being pre-merged with `objectMergeRight`. The JS-only vitest
 * relaxations from eslint-v9-js-vitest are deliberately absent — they don't apply
 * under typed linting.
 */
export const configs: Record<'base', Linter.Config[]> = {
  base: defineConfig(jsBaseConfig, vitestLayer, tsLayer, tsTestLayer, tsVitestLayer),
};
