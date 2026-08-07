import { resolve } from 'path';

import { describe, it, expect } from 'vitest';

import { getEnabledDeprecatedRules, getEnabledRuleNames } from './stats';

import { baseConfig } from './index';

const STATS_DIR = resolve(__dirname, '..', 'stats');

describe('getEnabledRuleNames', () => {
  it('accepts a single config object, same as before this ticket', () => {
    expect(getEnabledRuleNames(baseConfig)).toStrictEqual(getEnabledRuleNames([baseConfig]));
  });

  it('does not include a rule turned off by a later array entry', () => {
    expect(getEnabledRuleNames([{ rules: { a: 1 } }, { rules: { a: 0 } }])).not.toContain('a');
  });

  it('includes a rule turned on by a later array entry', () => {
    expect(getEnabledRuleNames([{ rules: { a: 0 } }, { rules: { a: 1 } }])).toContain('a');
  });

  it('sorts returned names with localeCompare', () => {
    expect(getEnabledRuleNames([{ rules: { zeta: 1, alpha: 1, mu: 1 } }])).toStrictEqual([
      'alpha',
      'mu',
      'zeta',
    ]);
  });
});

describe('getEnabledDeprecatedRules', () => {
  it('accepts an array of configs and folds them before checking deprecation', () => {
    expect(getEnabledDeprecatedRules([baseConfig], STATS_DIR)).toStrictEqual(
      getEnabledDeprecatedRules(baseConfig, STATS_DIR)
    );
  });
});
