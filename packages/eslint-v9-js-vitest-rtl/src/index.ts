import { EslintConfig } from '@ladamczyk/qoq-eslint-v9-js';
import { baseConfig as jsVitestBaseConfig } from '@ladamczyk/qoq-eslint-v9-js-vitest';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import testingLibrary from 'eslint-plugin-testing-library';

export const disabledRules: EslintConfig['rules'] = {
  'testing-library/prefer-screen-queries': 0,
};

const { plugins: jsVitestBaseConfiglugins, ...jsVitestBaseConfigRest } = jsVitestBaseConfig;
const { plugins: jsRtlBaseConfigPlugins, ...jsRtlBaseConfigRest } =
  testingLibrary.configs['flat/react'];

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsVitestBaseConfigRest, {
    ...jsRtlBaseConfigRest,
    name: 'qoq-eslint-v9-js-vitest-rtl',
    rules: {
      ...disabledRules,
    },
  }),
  plugins: {
    ...jsVitestBaseConfiglugins,
    ...jsRtlBaseConfigPlugins,
  },
};
