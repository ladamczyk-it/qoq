import reactPlugin from '@eslint-react/eslint-plugin';
import { EslintConfig, baseConfig as jsBaseConfig } from '@ladamczyk/qoq-eslint-v9-js';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import stylisticPlugin from '@stylistic/eslint-plugin';
import compatPlugin from 'eslint-plugin-compat';

import type { Linter } from 'eslint';

const baseNoRestrictedImports = jsBaseConfig.rules['no-restricted-imports'] as [
  Linter.RuleSeverity,
  { paths: unknown[] },
];

const noRestrictedImportsRule: EslintConfig['rules'][0] = [
  baseNoRestrictedImports[0],
  {
    ...baseNoRestrictedImports[1],
    paths: [
      ...baseNoRestrictedImports[1].paths,
      {
        name: 'lodash/debounce',
        message:
          "Since this is a React project please use use-bebounce instead it's newer and tiny.",
      },
      {
        name: 'lodash/fp/debounce',
        message:
          "Since this is a React project please use use-bebounce instead it's newer and tiny.",
      },
    ],
  },
];

const baseImportOrder = jsBaseConfig.rules['import-x/order'] as [
  Linter.RuleSeverity,
  Record<string, unknown>,
];

const importOrderRule: EslintConfig['rules'][0] = [
  baseImportOrder[0],
  {
    ...baseImportOrder[1],
    pathGroups: [
      {
        pattern: 'react*',
        group: 'builtin',
        position: 'before',
      },
    ],
    pathGroupsExcludedImportTypes: ['react*'],
  },
];

export const disabledRules: EslintConfig['rules'] = {
  'sonarjs/function-return-type': 0,
  '@stylistic/indent': 0,
  '@stylistic/operator-linebreak': 0,
  '@stylistic/comma-dangle': 0,
  '@stylistic/arrow-parens': 0,
  '@stylistic/semi': 0,
  '@stylistic/brace-style': 0,
  '@stylistic/member-delimiter-style': 0,
  '@stylistic/quotes': 0,
  '@stylistic/multiline-ternary': 0,
  '@stylistic/jsx-one-expression-per-line': 0,
  '@stylistic/indent-binary-ops': 0,
  '@stylistic/jsx-curly-newline': 0,
  '@stylistic/quote-props': 0,
};

const { plugins: jsBaseConfigPlugins, ...jsBaseConfigRest } = jsBaseConfig;

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsBaseConfigRest, {
    name: 'qoq-eslint-v9-js-react',
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...compatPlugin.configs['flat/recommended'].rules,
      ...reactPlugin.configs.recommended.rules,
      ...stylisticPlugin.configs.recommended.rules,
      'import-x/order': importOrderRule,
      'no-restricted-imports': noRestrictedImportsRule,
      ...disabledRules,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  }),
  plugins: {
    ...jsBaseConfigPlugins,
    compat: compatPlugin,
    '@stylistic': stylisticPlugin,
    '@eslint-react': reactPlugin,
  },
};
