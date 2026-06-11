import reactPlugin from '@eslint-react/eslint-plugin';
import { EslintConfig } from '@ladamczyk/qoq-eslint-v9-js';
import { baseConfig as jsReactBaseConfig, disabledRules } from '@ladamczyk/qoq-eslint-v9-js-react';
import { baseConfig as tsBaseConfig } from '@ladamczyk/qoq-eslint-v9-ts';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import importPlugin from 'eslint-plugin-import-x';

const { plugins: jsReactBaseConfigPlugins, ...jsReactBaseConfigRest } = jsReactBaseConfig;
const { plugins: tsBaseConfigPlugins, ...tsBaseConfigRest } = tsBaseConfig;

export const baseConfig: EslintConfig = {
  ...objectMergeRight(
    jsReactBaseConfigRest,
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
      name: 'qoq-eslint-v9-ts-react',
      rules: {
        ...disabledRules,
        ...(reactPlugin.configs['recommended-typescript'].rules ?? {}),
      } as EslintConfig['rules'],
    }
  ),
  plugins: { ...jsReactBaseConfigPlugins, ...tsBaseConfigPlugins },
};
