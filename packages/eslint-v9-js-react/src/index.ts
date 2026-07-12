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
  // The rest of the @stylistic recommended set below is pure whitespace/punctuation
  // formatting that `prettier/prettier` (from the JS base config) already normalizes
  // identically — keeping both just double-reports and double-costs the same diff.
  '@stylistic/array-bracket-spacing': 0,
  '@stylistic/arrow-spacing': 0,
  '@stylistic/block-spacing': 0,
  '@stylistic/comma-spacing': 0,
  '@stylistic/comma-style': 0,
  '@stylistic/computed-property-spacing': 0,
  '@stylistic/dot-location': 0,
  '@stylistic/eol-last': 0,
  '@stylistic/generator-star-spacing': 0,
  '@stylistic/jsx-closing-bracket-location': 0,
  '@stylistic/jsx-closing-tag-location': 0,
  '@stylistic/jsx-curly-spacing': 0,
  '@stylistic/jsx-equals-spacing': 0,
  '@stylistic/jsx-first-prop-new-line': 0,
  '@stylistic/jsx-function-call-newline': 0,
  '@stylistic/jsx-tag-spacing': 0,
  '@stylistic/key-spacing': 0,
  '@stylistic/keyword-spacing': 0,
  '@stylistic/new-parens': 0,
  '@stylistic/no-mixed-spaces-and-tabs': 0,
  '@stylistic/no-multi-spaces': 0,
  '@stylistic/no-multiple-empty-lines': 0,
  '@stylistic/no-tabs': 0,
  '@stylistic/no-trailing-spaces': 0,
  '@stylistic/no-whitespace-before-property': 0,
  '@stylistic/object-curly-spacing': 0,
  '@stylistic/padded-blocks': 0,
  '@stylistic/rest-spread-spacing': 0,
  '@stylistic/semi-spacing': 0,
  '@stylistic/space-before-blocks': 0,
  '@stylistic/space-before-function-paren': 0,
  '@stylistic/space-in-parens': 0,
  '@stylistic/space-infix-ops': 0,
  '@stylistic/space-unary-ops': 0,
  '@stylistic/template-curly-spacing': 0,
  '@stylistic/template-tag-spacing': 0,
  '@stylistic/yield-star-spacing': 0,
  // Left enabled while their non-JSX siblings above (`indent`, `quotes`) are disabled —
  // an inconsistency, not intentional; Prettier owns these too.
  '@stylistic/jsx-indent-props': 0,
  '@stylistic/jsx-quotes': 0,
  // Known to conflict with Prettier's own parenthesization choices (ternaries/JSX) —
  // one of the rules eslint-config-prettier disables for exactly this reason.
  '@stylistic/no-extra-parens': 0,
  // TS-only — this package is JS-only, so these never match any node.
  '@stylistic/type-annotation-spacing': 0,
  '@stylistic/type-generic-spacing': 0,
  '@stylistic/type-named-tuple-spacing': 0,
};

// Restores the JSX/DOM-markup sonarjs rules the base config disables, at sonarjs's
// own recommended severities, so this package is the only place they're applied.
// `no-hook-setter-in-body` is intentionally excluded: it flags the same pattern
// (an unconditional state-setter call in a component's render body) as
// `@eslint-react/set-state-in-render`, which already covers it more broadly.
const restoredReactRules: EslintConfig['rules'] = Object.fromEntries(
  REACT_ONLY_SONARJS_RULES.filter((rule) => rule !== 'no-hook-setter-in-body').map((rule) => [
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
