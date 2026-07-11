import {
  EslintConfig,
  SONARJS_RECOMMENDED_RULES,
  TEST_ONLY_SONARJS_RULES,
} from '@ladamczyk/qoq-eslint-v9-js';
import {
  baseConfig as jsVitestBaseConfig,
  disabledRules,
} from '@ladamczyk/qoq-eslint-v9-js-vitest';
import { testConfig as tsTestConfig } from '@ladamczyk/qoq-eslint-v9-ts';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import importPlugin from 'eslint-plugin-import-x';

const { plugins: jsVitestBaseConfigPlugins, ...jsVitestBaseConfigRest } = jsVitestBaseConfig;
const { plugins: tsTestConfigPlugins, ...tsTestConfigRest } = tsTestConfig;

// tsTestConfigRest is merged in after jsVitestBaseConfigRest and still carries the
// test rules disabled (it's built from eslint-v9-js, not eslint-v9-js-vitest), so its
// "off" wins the objectMergeRight merge unless re-restored here as the final override.
const restoredTestRules: EslintConfig['rules'] = Object.fromEntries(
  TEST_ONLY_SONARJS_RULES.map((rule) => [
    `sonarjs/${rule}`,
    SONARJS_RECOMMENDED_RULES[`sonarjs/${rule}`]!,
  ])
);

export const baseConfig: EslintConfig = {
  ...objectMergeRight(
    jsVitestBaseConfigRest,
    {
      rules: Object.keys(importPlugin.configs.recommended.rules).reduce(
        (acc: Record<string, undefined>, key) => {
          acc[key] = undefined;

          return acc;
        },
        {}
      ) as unknown as EslintConfig['rules'],
    },
    tsTestConfigRest,
    {
      name: 'qoq-eslint-v9-ts-vitest',
      rules: { ...restoredTestRules, ...disabledRules },
      settings: {
        vitest: {
          typecheck: true,
        },
      },
    }
  ),
  plugins: { ...jsVitestBaseConfigPlugins, ...tsTestConfigPlugins },
};
