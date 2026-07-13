import {
  EslintConfig,
  TEST_ONLY_SONARJS_RULES,
  baseConfig as jsBaseConfig,
  restoreSonarjsRules,
} from '@ladamczyk/qoq-eslint-v9-js';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import vitestPlugin from '@vitest/eslint-plugin';

export const disabledRules: EslintConfig['rules'] = {
  'sonarjs/no-duplicate-string': 0,
  // Duplicates of vitest's own recommended rules - same violation would be reported
  // twice under two rule IDs. `no-skipped-tests` is also strictly narrower than
  // `no-disabled-tests` (it allows a skip with a reason string; vitest's doesn't).
  'sonarjs/no-skipped-tests': 0, // duplicates vitest/no-disabled-tests
  'sonarjs/no-exclusive-tests': 0, // duplicates vitest/no-focused-tests
  'sonarjs/no-duplicate-test-title': 0, // duplicates vitest/no-identical-title
  'sonarjs/no-empty-test-title': 0, // duplicates vitest/valid-title
  'sonarjs/assertions-in-tests': 0, // duplicates vitest/expect-expect
  // These three hard-gate on `import ... from 'chai'` (see each rule's source) and
  // this package has no chai dependency, so they can never produce a finding here.
  'sonarjs/disabled-timeout': 0,
  'sonarjs/chai-determinate-assertion': 0,
  'sonarjs/no-same-argument-assert': 0,
};

// This package configures no TypeScript parser/project, and this rule's implementation
// returns `{}` (a hard no-op) without typed-linting parser services — so unlike the other
// TEST_ONLY_SONARJS_RULES restored below, it can never fire here. Not added to
// `disabledRules` above: eslint-v9-ts-vitest *does* have type info and re-restores this
// rule itself, so sharing the override there would wrongly turn off a rule that works for it.
const jsOnlyDisabledRules: EslintConfig['rules'] = {
  'sonarjs/no-incompatible-assertion-types': 0,
};

const additionalVitestRules: EslintConfig['rules'] = {
  'vitest/no-duplicate-hooks': 1,
  'vitest/no-conditional-in-test': 1,
  'vitest/no-test-return-statement': 1,
  'vitest/no-large-snapshots': 1,
  'vitest/prefer-strict-equal': 1,
  'vitest/prefer-to-be': 1,
  // Catches `fit`/`xit`/`fdescribe`/`xdescribe` — a gap `no-focused-tests`/`no-disabled-tests`
  // below don't cover, since those only match the `.only`/`.skip` member form.
  'vitest/no-test-prefixes': 1,
  // Distinct from `no-conditional-in-test` above: that one flags an `if` inside a test body,
  // this one flags a test/describe registration itself wrapped in `if`, which can make the
  // test silently never run at all.
  'vitest/no-conditional-tests': 1,
  'vitest/prefer-hooks-in-order': 1,
  'vitest/max-nested-describe': 1,
  'vitest/require-to-throw-message': 1,
};

// Restores the test-lifecycle/assertion sonarjs rules the base config disables,
// at sonarjs's own recommended severities, so this package (and everything that
// spec-file-scopes it) is the only place they're actually applied.
const restoredTestRules = restoreSonarjsRules(TEST_ONLY_SONARJS_RULES);

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
      ...jsOnlyDisabledRules,
    },
  }),
  plugins: {
    ...jsBaseConfigPlugins,
    vitest: vitestPlugin,
  },
};
