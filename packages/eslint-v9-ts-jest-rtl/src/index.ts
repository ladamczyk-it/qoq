import { EslintConfig } from '@ladamczyk/qoq-eslint-v9-js';
import {
  baseConfig as jsJestBaseConfig,
  disabledRules,
} from '@ladamczyk/qoq-eslint-v9-js-jest-rtl';
import { baseConfig as tsBaseConfig } from '@ladamczyk/qoq-eslint-v9-ts-jest';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import importPlugin from 'eslint-plugin-import-x';

const { plugins: jsJestRtlBaseConfigPlugins, ...jsJestRtlBaseConfigRest } = jsJestBaseConfig;
const { plugins: tsBaseConfigPlugins, ...tsBaseConfigRest } = tsBaseConfig;

export const baseConfig: EslintConfig = {
  ...objectMergeRight(
    jsJestRtlBaseConfigRest,
    {
      rules: Object.keys(importPlugin.configs.recommended.rules).reduce(
        (acc: Record<string, undefined>, key) => {
          acc[key] = undefined;

          return acc;
        },
        {}
      ) as unknown as EslintConfig['rules'],
    },
    tsBaseConfigRest,
    {
      name: '@ladamczyk/qoq-eslint-v9-ts-jest-rtl',
      rules: { ...disabledRules },
    }
  ),
  plugins: { ...jsJestRtlBaseConfigPlugins, ...tsBaseConfigPlugins },
};
