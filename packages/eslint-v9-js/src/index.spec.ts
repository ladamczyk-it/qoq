import { resolve } from 'path';

import { describe, it, expect } from 'vitest';

import { getEnabledDeprecatedRules, getEnabledRuleNames } from './stats';

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

  it('throws when the inspector payload is missing', () => {
    expect(() =>
      getEnabledDeprecatedRules(configs.base, resolve(__dirname, 'does-not-exist'))
    ).toThrow(/no such file or directory/);
  });
});
