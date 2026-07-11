import reactPlugin from '@eslint-react/eslint-plugin';
import {
  EslintConfig,
  REACT_ONLY_SONARJS_RULES,
  SONARJS_RECOMMENDED_RULES,
} from '@ladamczyk/qoq-eslint-v9-js';
import {
  NO_MULTI_COMP_RULE_NAME,
  baseConfig as jsReactBaseConfig,
  disabledRules,
} from '@ladamczyk/qoq-eslint-v9-js-react';
import { baseConfig as tsBaseConfig } from '@ladamczyk/qoq-eslint-v9-ts';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import importPlugin from 'eslint-plugin-import-x';

const { plugins: jsReactBaseConfigPlugins, ...jsReactBaseConfigRest } = jsReactBaseConfig;
const { plugins: tsBaseConfigPlugins, ...tsBaseConfigRest } = tsBaseConfig;

// tsBaseConfigRest is merged in after jsReactBaseConfigRest and still carries the
// React/JSX rules disabled (it's built from eslint-v9-js, not eslint-v9-js-react), so
// its "off" wins the objectMergeRight merge unless re-restored here as the final override.
const restoredReactRules: EslintConfig['rules'] = Object.fromEntries(
  REACT_ONLY_SONARJS_RULES.map((rule) => [
    `sonarjs/${rule}`,
    SONARJS_RECOMMENDED_RULES[`sonarjs/${rule}`]!,
  ])
);

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
        ...restoredReactRules,
        ...disabledRules,
        ...(reactPlugin.configs['recommended-typescript'].rules ?? {}),
        // Our custom rule lives in (and is registered by) `eslint-v9-js-react`;
        // re-assert it here so it survives the `recommended-typescript` merge.
        [`@eslint-react/${NO_MULTI_COMP_RULE_NAME}`]: 2,
      },
    }
  ),
  plugins: { ...jsReactBaseConfigPlugins, ...tsBaseConfigPlugins },
};
