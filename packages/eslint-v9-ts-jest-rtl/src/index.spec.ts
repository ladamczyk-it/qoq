import { resolve } from 'path';

import { getEnabledDeprecatedRules, getEnabledRuleNames } from '@ladamczyk/qoq-eslint-v9-js/stats';
import { describe, it, expect } from 'vitest';

import { baseConfig } from './index';

const STATS_DIR = resolve(__dirname, '..', 'stats');

describe('eslint config deprecation guard', () => {
  it('resolves the rules the package config enables', () => {
    // Reads straight from `baseConfig`, so it also exercises `index.ts`.
    expect(getEnabledRuleNames(baseConfig)).toContain('eqeqeq');
  });

  it('does not enable any deprecated rules', () => {
    expect(getEnabledDeprecatedRules(baseConfig, STATS_DIR)).toStrictEqual([]);
  });
});
