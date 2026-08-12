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

describe('layer composition order', () => {
  it('composes configs.base from the expected layer ancestry', () => {
    expect(configs.base.map((c) => c.name)).toStrictEqual([
      'qoq-eslint-v9-js',
      'qoq-eslint-v9-js-jest',
      'qoq-eslint-v9-js-jest-rtl',
      'qoq-eslint-v9-js-jest-rtl-js-only',
    ]);
  });
});
