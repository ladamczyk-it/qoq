import { EslintConfig } from '@ladamczyk/qoq-eslint-v9-js';
import { baseConfig as jsJestBaseConfig } from '@ladamczyk/qoq-eslint-v9-js-jest';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import testingLibrary from 'eslint-plugin-testing-library';

export const disabledRules: EslintConfig['rules'] = {
  'testing-library/prefer-screen-queries': 0,
};

const { plugins: jsJestBaseConfigPlugins, ...jsJestBaseConfigRest } = jsJestBaseConfig;
const { plugins: jsRtlBaseConfigPlugins, ...jsRtlBaseConfigRest } =
  testingLibrary.configs['flat/react'];

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsJestBaseConfigRest, {
    ...jsRtlBaseConfigRest,
    name: '@ladamczyk/qoq-eslint-v9-js-jest-rtl',
    rules: { ...disabledRules },
  }),
  plugins: {
    ...jsJestBaseConfigPlugins,
    ...jsRtlBaseConfigPlugins,
  },
};
