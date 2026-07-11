import {
  EslintConfig,
  SONARJS_RECOMMENDED_RULES,
  TEST_ONLY_SONARJS_RULES,
  baseConfig as jsBaseConfig,
} from '@ladamczyk/qoq-eslint-v9-js';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import vitestPlugin from '@vitest/eslint-plugin';

export const disabledRules: EslintConfig['rules'] = {
  'sonarjs/no-duplicate-string': 0,
  'vitest/expect-expect': 0,
  /**
   * @todo need to investigate this one
   */
  'vitest/prefer-called-exactly-once-with': 0,
};

// Restores the test-lifecycle/assertion sonarjs rules the base config disables,
// at sonarjs's own recommended severities, so this package (and everything that
// spec-file-scopes it) is the only place they're actually applied.
const restoredTestRules: EslintConfig['rules'] = Object.fromEntries(
  TEST_ONLY_SONARJS_RULES.map((rule) => [
    `sonarjs/${rule}`,
    SONARJS_RECOMMENDED_RULES[`sonarjs/${rule}`]!,
  ])
);

const { plugins: jsBaseConfigPlugins, ...jsBaseConfigRest } = jsBaseConfig;

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsBaseConfigRest, {
    name: 'qoq-eslint-v9-js-vitest',
    languageOptions: {
      globals: {
        ...vitestPlugin.environments.env.globals,
      },
    },
    rules: {
      ...vitestPlugin.configs.recommended.rules,
      ...restoredTestRules,
      ...disabledRules,
    },
  }),
  plugins: {
    ...jsBaseConfigPlugins,
    vitest: vitestPlugin,
  },
};
