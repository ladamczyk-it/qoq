import { resolve } from 'path';

import { getEnabledDeprecatedRules, getEnabledRuleNames } from '@ladamczyk/qoq-eslint-v9-js/stats';
import { describe, it, expect } from 'vitest';

import { configs } from './index';

const STATS_DIR = resolve(__dirname, '..', 'stats');

describe('eslint config deprecation guard', () => {
  it('resolves the rules the package config enables', () => {
    // Reads straight from `configs.base`, so it also exercises `index.ts`.
    expect(getEnabledRuleNames(configs.base)).toContain('eqeqeq');
  });

  it('does not enable any deprecated rules', () => {
    expect(getEnabledDeprecatedRules(configs.base, STATS_DIR)).toStrictEqual([]);
  });
});

describe('rule parity with master', () => {
  // Restored by plan 5.8: a merge resolution silently dropped master's deliberate
  // removal of this rule, and nothing in the gate catches that class of error.
  it('does not enable @typescript-eslint/switch-exhaustiveness-check', () => {
    expect(getEnabledRuleNames(configs.base)).not.toContain(
      '@typescript-eslint/switch-exhaustiveness-check'
    );
  });
});

describe('layer composition order', () => {
  it('composes configs.base from the expected layer ancestry', () => {
    expect(configs.base.map((c) => c.name)).toStrictEqual(['qoq-eslint-v9-js', 'qoq-eslint-v9-ts']);
  });

  it('composes configs.test from the expected layer ancestry', () => {
    expect(configs.test.map((c) => c.name)).toStrictEqual([
      'qoq-eslint-v9-js',
      'qoq-eslint-v9-ts',
      'qoq-eslint-v9-ts-test',
    ]);
  });

  it('composes configs.strict from the expected layer ancestry', () => {
    expect(configs.strict.map((c) => c.name)).toStrictEqual([
      'qoq-eslint-v9-js',
      'qoq-eslint-v9-ts',
      'qoq-eslint-v9-ts-strict',
    ]);
  });
});
