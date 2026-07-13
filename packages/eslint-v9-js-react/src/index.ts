import reactPlugin from '@eslint-react/eslint-plugin';
import {
  ESLINT_CONFIG_PRETTIER_RULES,
  EslintConfig,
  REACT_ONLY_SONARJS_RULES,
  baseConfig as jsBaseConfig,
  getNoRestrictedImportsRule,
  restoreSonarjsRules,
} from '@ladamczyk/qoq-eslint-v9-js';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import stylisticPlugin from '@stylistic/eslint-plugin';
import compatPlugin from 'eslint-plugin-compat';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import globals from 'globals';

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

const noRestrictedImportsRule: EslintConfig['rules'][0] = getNoRestrictedImportsRule([
  {
    name: 'lodash/debounce',
    message: "Since this is a React project please use use-debounce instead it's newer and tiny.",
  },
  {
    name: 'lodash/fp/debounce',
    message: "Since this is a React project please use use-debounce instead it's newer and tiny.",
  },
]);

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
  // Not part of eslint-config-prettier's list below — pure whitespace formatting
  // that Prettier already normalizes, just not one it accounts for.
  '@stylistic/jsx-function-call-newline': 0,
  // Disables every core/`@stylistic` rule that conflicts with (or is made redundant by)
  // Prettier owning formatting — see the JS base config for why this is spread rather
  // than hand-listed.
  ...ESLINT_CONFIG_PRETTIER_RULES,
};

// Restores the JSX/DOM-markup sonarjs rules the base config disables, at sonarjs's
// own recommended severities, so this package is the only place they're applied.
// `no-hook-setter-in-body` is intentionally excluded: it flags the same pattern
// (an unconditional state-setter call in a component's render body) as
// `@eslint-react/set-state-in-render`, which already covers it more broadly.
const restoredReactRules = restoreSonarjsRules(REACT_ONLY_SONARJS_RULES, [
  'no-hook-setter-in-body',
]);

const { plugins: jsBaseConfigPlugins, ...jsBaseConfigRest } = jsBaseConfig;

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsBaseConfigRest, {
    name: 'qoq-eslint-v9-js-react',
    languageOptions: {
      // Merged on top of the JS base's node globals. Without these, `no-undef`
      // (error, from @eslint/js recommended) flags `window`/`document` in every
      // plain-JS React project — TS variants never noticed since `eslint-v9-ts`
      // turns `no-undef` off.
      globals: {
        ...globals.browser,
      },
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
