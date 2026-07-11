import reactPlugin from '@eslint-react/eslint-plugin';
import {
  EslintConfig,
  REACT_ONLY_SONARJS_RULES,
  SONARJS_RECOMMENDED_RULES,
  baseConfig as jsBaseConfig,
} from '@ladamczyk/qoq-eslint-v9-js';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import stylisticPlugin from '@stylistic/eslint-plugin';
import compatPlugin from 'eslint-plugin-compat';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';

import { NO_MULTI_COMP_RULE_NAME, noMultiCompRule } from './rules/no-multi-comp';

import type { ESLint, Linter } from 'eslint';

export * from './rules/no-multi-comp';

/**
 * The `@eslint-react/eslint-plugin` plugin, extended with our custom
 * `no-multi-comp` rule so it is enabled under the `@eslint-react` namespace
 * (`@eslint-react/no-multi-comp`). The original plugin object is left untouched.
 */
const reactPluginWithCustomRules: ESLint.Plugin = {
  ...reactPlugin,
  rules: {
    ...reactPlugin.rules,
    [NO_MULTI_COMP_RULE_NAME]: noMultiCompRule,
  },
};

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
  '@stylistic/jsx-wrap-multilines': 0,
  '@stylistic/quote-props': 0,
};

// Restores the JSX/DOM-markup sonarjs rules the base config disables, at sonarjs's
// own recommended severities, so this package is the only place they're applied.
const restoredReactRules: EslintConfig['rules'] = Object.fromEntries(
  REACT_ONLY_SONARJS_RULES.map((rule) => [
    `sonarjs/${rule}`,
    SONARJS_RECOMMENDED_RULES[`sonarjs/${rule}`]!,
  ])
);

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
      ...restoredReactRules,
      'import-x/order': importOrderRule,
      'no-restricted-imports': noRestrictedImportsRule,
      '@eslint-react/no-multi-comp': 2,
      // Keep jsx/tsx files Fast-Refresh-safe (HMR): a module may export
      // multiple components, but mixing component and non-component exports
      // breaks Fast Refresh. `allowConstantExport` permits Vite-style constants.
      'react-refresh/only-export-components': [2, { allowConstantExport: true }],
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
    '@eslint-react': reactPluginWithCustomRules,
    'react-refresh': reactRefreshPlugin,
  },
};
