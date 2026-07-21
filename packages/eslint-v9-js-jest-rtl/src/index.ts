import { EslintConfig } from '@ladamczyk/qoq-eslint-v9-js';
import { baseConfig as jsJestBaseConfig } from '@ladamczyk/qoq-eslint-v9-js-jest';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import testingLibrary from 'eslint-plugin-testing-library';

export const disabledRules: EslintConfig['rules'] = {
  'testing-library/prefer-screen-queries': 0,
};

// Not part of `flat/react` recommended. Pushes toward accessible queries (role/label/text)
// over implementation-detail selectors, in the spirit of the RTL rules already enabled here.
const additionalTestingLibraryRules: EslintConfig['rules'] = {
  'testing-library/prefer-user-event': 1,
};

const { plugins: jsJestBaseConfigPlugins, ...jsJestBaseConfigRest } = jsJestBaseConfig;
const { plugins: jsRtlBaseConfigPlugins, ...jsRtlBaseConfigRest } =
  testingLibrary.configs['flat/react'];

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsJestBaseConfigRest, {
    ...jsRtlBaseConfigRest,
    name: 'qoq-eslint-v9-js-jest-rtl',
    rules: {
      ...additionalTestingLibraryRules,
      ...disabledRules,
    },
  }),
  plugins: {
    ...jsJestBaseConfigPlugins,
    ...jsRtlBaseConfigPlugins,
  },
};
