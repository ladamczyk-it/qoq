import {
  EslintConfig,
  TEST_ONLY_SONARJS_RULES,
  baseConfig as jsBaseConfig,
  restoreSonarjsRules,
} from '@ladamczyk/qoq-eslint-v9-js';
import { defineConfig } from 'eslint/config';
import jestPlugin from 'eslint-plugin-jest';
import globals from 'globals';

import type { Linter } from 'eslint';

export const disabledRules: EslintConfig['rules'] = {
  'sonarjs/no-duplicate-string': 0,
  // Duplicates of rules eslint-plugin-jest's own `recommended` config already enables
  // (registered below, and applied by eslint-v9-ts-jest which appends this package's jestLayer) —
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

/**
 * Everything this package adds or changes on top of the JS base, as a single
 * flat-config layer for `defineConfig` composition. Shared by the TS variant
 * (eslint-v9-ts-jest appends it to its own chain), so JS-only overrides stay
 * out of it — `jsOnlyDisabledRules` above is composed in separately below.
 */
export const jestLayer: EslintConfig = {
  name: 'qoq-eslint-v9-js-jest',
  languageOptions: {
    globals: {
      ...globals.jest,
    },
  },
  plugins: {
    jest: jestPlugin,
  },
  rules: {
    ...jestPlugin.configs.recommended.rules,
    ...restoredTestRules,
    ...additionalJestRules,
    ...disabledRules,
  } as EslintConfig['rules'],
};

/**
 * Flat-config array form: the JS base, the jest layer, and the JS-only
 * relaxations, merged per file by ESLint's own cascade instead of being
 * pre-merged with `objectMergeRight`.
 */
export const configs: Record<'base', Linter.Config[]> = {
  base: defineConfig(jsBaseConfig, jestLayer, {
    name: 'qoq-eslint-v9-js-jest-js-only',
    rules: jsOnlyDisabledRules,
  }),
};
