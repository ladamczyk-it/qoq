import {
  EslintConfig,
  SONARJS_RECOMMENDED_RULES,
  TEST_ONLY_SONARJS_RULES,
  baseConfig as jsBaseConfig,
} from '@ladamczyk/qoq-eslint-v9-js';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import vitestPlugin from '@vitest/eslint-plugin';

export const disabledRules: EslintConfig['rules'] = {
  'sonarjs/no-duplicate-string': 0,
  'vitest/expect-expect': 0,
  /**
   * @todo need to investigate this one
   */
  'vitest/prefer-called-exactly-once-with': 0,
  // Duplicates of vitest's own recommended rules - same violation would be reported
  // twice under two rule IDs. `no-skipped-tests` is also strictly narrower than
  // `no-disabled-tests` (it allows a skip with a reason string; vitest's doesn't).
  'sonarjs/no-skipped-tests': 0, // duplicates vitest/no-disabled-tests
  'sonarjs/no-exclusive-tests': 0, // duplicates vitest/no-focused-tests
  'sonarjs/no-duplicate-test-title': 0, // duplicates vitest/no-identical-title
  'sonarjs/no-empty-test-title': 0, // duplicates vitest/valid-title
  // These three hard-gate on `import ... from 'chai'` (see each rule's source) and
  // this package has no chai dependency, so they can never produce a finding here.
  'sonarjs/disabled-timeout': 0,
  'sonarjs/chai-determinate-assertion': 0,
  'sonarjs/no-same-argument-assert': 0,
};

const additionalVitestRules: EslintConfig['rules'] = {
  'vitest/no-duplicate-hooks': 1,
  'vitest/no-conditional-in-test': 1,
  'vitest/no-test-return-statement': 1,
  'vitest/no-large-snapshots': 1,
  'vitest/prefer-strict-equal': 1,
  'vitest/prefer-to-be': 1,
};

// Restores the test-lifecycle/assertion sonarjs rules the base config disables,
// at sonarjs's own recommended severities, so this package (and everything that
// spec-file-scopes it) is the only place they're actually applied.
const restoredTestRules: EslintConfig['rules'] = Object.fromEntries(
  TEST_ONLY_SONARJS_RULES.map((rule) => [
    `sonarjs/${rule}`,
    SONARJS_RECOMMENDED_RULES[`sonarjs/${rule}`]!,
  ])
);

const { plugins: jsBaseConfigPlugins, ...jsBaseConfigRest } = jsBaseConfig;

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsBaseConfigRest, {
    name: 'qoq-eslint-v9-js-vitest',
    languageOptions: {
      globals: {
        ...vitestPlugin.environments.env.globals,
      },
    },
    rules: {
      ...vitestPlugin.configs.recommended.rules,
      ...restoredTestRules,
      ...additionalVitestRules,
      ...disabledRules,
    },
  }),
  plugins: {
    ...jsBaseConfigPlugins,
    vitest: vitestPlugin,
  },
};
