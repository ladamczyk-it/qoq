import {
  EslintConfig,
  TEST_ONLY_SONARJS_RULES,
  baseConfig as jsBaseConfig,
  restoreSonarjsRules,
} from '@ladamczyk/qoq-eslint-v9-js';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import jestPlugin from 'eslint-plugin-jest';
import globals from 'globals';

export const disabledRules: EslintConfig['rules'] = {
  'sonarjs/no-duplicate-string': 0,
  // Duplicates of rules eslint-plugin-jest's own `recommended` config already enables
  // (registered below, and inherited by eslint-v9-ts-jest via this package's baseConfig) —
  // reporting the same violation through two rules doubles the check's cost for no extra
  // signal, so keep the jest-aware rule and drop the sonarjs one.
  'sonarjs/no-skipped-tests': 0, // duplicates jest/no-disabled-tests
  'sonarjs/no-exclusive-tests': 0, // duplicates jest/no-focused-tests
  'sonarjs/no-duplicate-test-title': 0, // duplicates jest/no-identical-title
  'sonarjs/assertions-in-tests': 0, // duplicates jest/expect-expect
  'sonarjs/no-empty-test-title': 0, // duplicates jest/valid-title ("not empty" check)
  // Hard-gate on Mocha/Chai usage (`disabled-timeout` on Mocha-style timeouts, the other
  // two on `import ... from 'chai'` — see each rule's source), and a Jest consumer has
  // neither, so they can never fire here; restoring them just costs a visitor pass on
  // every spec file for a check with no possible signal.
  'sonarjs/disabled-timeout': 0,
  'sonarjs/chai-determinate-assertion': 0,
  'sonarjs/no-same-argument-assert': 0,
};

// This package configures no TypeScript parser/project, and this rule's implementation
// returns `{}` (a hard no-op) without typed-linting parser services — so unlike the other
// TEST_ONLY_SONARJS_RULES restored below, it can never fire here. Not added to
// `disabledRules` above: eslint-v9-ts-jest *does* have type info and re-restores this rule
// itself, so sharing the override there would wrongly turn off a rule that works for it.
const jsOnlyDisabledRules: EslintConfig['rules'] = {
  'sonarjs/no-incompatible-assertion-types': 0,
};

// Not part of eslint-plugin-jest's `recommended` config, but cheap and non-overlapping
// with everything else enabled above.
const additionalJestRules: EslintConfig['rules'] = {
  'jest/no-duplicate-hooks': 1,
  'jest/no-large-snapshots': 1,
  'jest/prefer-strict-equal': 1,
  'jest/no-conditional-in-test': 1,
  'jest/require-to-throw-message': 1,
  'jest/no-test-return-statement': 1,
  'jest/prefer-to-be': 1,
  'jest/prefer-hooks-in-order': 1,
  'jest/max-nested-describe': 1,
};

// Restores the test-lifecycle/assertion sonarjs rules the base config disables,
// at sonarjs's own recommended severities, so this package (and everything that
// spec-file-scopes it) is the only place they're actually applied.
const restoredTestRules = restoreSonarjsRules(TEST_ONLY_SONARJS_RULES);

const { plugins: jsBaseConfigPlugins, ...jsBaseConfigRest } = jsBaseConfig;

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsBaseConfigRest, {
    name: 'qoq-eslint-v9-js-jest',
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      ...jestPlugin.configs.recommended.rules,
      ...restoredTestRules,
      ...additionalJestRules,
      ...disabledRules,
      ...jsOnlyDisabledRules,
    } as EslintConfig['rules'],
  }),
  plugins: {
    ...jsBaseConfigPlugins,
    jest: jestPlugin,
  },
};
