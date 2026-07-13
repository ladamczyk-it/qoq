import {
  EslintConfig,
  TEST_ONLY_SONARJS_RULES,
  restoreSonarjsRules,
} from '@ladamczyk/qoq-eslint-v9-js';
import { baseConfig as jsJestBaseConfig, disabledRules } from '@ladamczyk/qoq-eslint-v9-js-jest';
import { testConfig as tsTestConfig } from '@ladamczyk/qoq-eslint-v9-ts';
import { objectMergeRight } from '@ladamczyk/qoq-utils';

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
