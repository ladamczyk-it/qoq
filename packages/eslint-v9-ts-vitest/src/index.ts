import {
  EslintConfig,
  TEST_ONLY_SONARJS_RULES,
  restoreSonarjsRules,
} from '@ladamczyk/qoq-eslint-v9-js';
import {
  baseConfig as jsVitestBaseConfig,
  disabledRules,
} from '@ladamczyk/qoq-eslint-v9-js-vitest';
import { testConfig as tsTestConfig } from '@ladamczyk/qoq-eslint-v9-ts';
import { objectMergeRight } from '@ladamczyk/qoq-utils';

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
