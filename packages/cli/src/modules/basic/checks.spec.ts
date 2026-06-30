import { describe, it, expect } from 'vitest';

import { QoqConfig } from '../../helpers/types.ts';

import { areRulesEqual, collectRedundancies, normalizeRuleEntry, TRulesRecord } from './checks.ts';

describe('normalizeRuleEntry', () => {
  it('should map numeric severities to their string form', () => {
    expect(normalizeRuleEntry(0)).toEqual(['off']);
    expect(normalizeRuleEntry(1)).toEqual(['warn']);
    expect(normalizeRuleEntry(2)).toEqual(['error']);
  });

  it('should lowercase string severities', () => {
    expect(normalizeRuleEntry('OFF')).toEqual(['off']);
    expect(normalizeRuleEntry('Error')).toEqual(['error']);
  });

  it('should wrap shorthand and array forms into a uniform shape', () => {
    expect(normalizeRuleEntry('off')).toEqual(['off']);
    expect(normalizeRuleEntry(['error'])).toEqual(['error']);
    expect(normalizeRuleEntry([2, 'single'])).toEqual(['error', 'single']);
  });
});

describe('areRulesEqual', () => {
  it('should treat numeric and string severities as equal', () => {
    expect(areRulesEqual(0, 'off')).toBe(true);
    expect(areRulesEqual(2, 'error')).toBe(true);
    expect(areRulesEqual('error', ['error'])).toBe(true);
    expect(areRulesEqual([2, 'single'], ['error', 'single'])).toBe(true);
  });

  it('should distinguish different severities and options', () => {
    expect(areRulesEqual('off', 'error')).toBe(false);
    expect(areRulesEqual(['error', 'single'], ['error', 'double'])).toBe(false);
  });
});

describe('collectRedundancies', () => {
  it('should return nothing for a clean config', () => {
    const config: QoqConfig = {
      npm: { checkOutdatedEvery: 7 },
      jscpd: { threshold: 5 },
      stylelint: { strict: true, template: 'qoq-stylelint-css' },
      skillslint: { path: './docs/skills' },
    };

    expect(collectRedundancies(config)).toEqual([]);
  });

  it('should return nothing for an empty config', () => {
    expect(collectRedundancies({})).toEqual([]);
  });

  it('should flag npm.checkOutdatedEvery when it matches the default', () => {
    const warnings = collectRedundancies({ npm: { checkOutdatedEvery: 1 } });

    expect(warnings).toEqual([
      { tool: 'npm', path: 'npm.checkOutdatedEvery', value: '1', reason: 'default' },
    ]);
  });

  it('should flag jscpd.threshold when it matches the default', () => {
    const warnings = collectRedundancies({ jscpd: { threshold: 2 } });

    expect(warnings).toEqual([
      { tool: 'jscpd', path: 'jscpd.threshold', value: '2', reason: 'default' },
    ]);
  });

  it('should flag stylelint.strict when it matches the default', () => {
    const warnings = collectRedundancies({
      stylelint: { strict: false, template: 'qoq-stylelint-css' },
    });

    expect(warnings).toEqual([
      { tool: 'stylelint', path: 'stylelint.strict', value: 'false', reason: 'default' },
    ]);
  });

  it('should not flag skillslint.path even when it matches the default', () => {
    // skillslint is an optional tool whose block is its activation switch, and
    // `path` is the required activating key — mandatory, never redundant.
    expect(collectRedundancies({ skillslint: { path: './skills' } })).toEqual([]);
  });

  it('should flag eslint rules already present in the base config (normalised)', () => {
    const config: QoqConfig = {
      eslint: [
        {
          template: 'qoq-eslint-v9-ts',
          files: ['src/**/*.ts'],
          rules: {
            'no-console': 0,
            'no-debugger': 'error',
            quotes: [2, 'single'],
            'custom/rule': 'error',
          },
        },
      ],
    };

    const baseRules: TRulesRecord = {
      'no-console': 'off',
      'no-debugger': ['error'],
      quotes: ['error', 'single'],
    };

    const warnings = collectRedundancies(config, { 0: baseRules });

    expect(warnings).toEqual([
      {
        tool: 'eslint',
        path: 'eslint[0].rules.no-console',
        value: '0',
        reason: 'base-config',
        template: 'qoq-eslint-v9-ts',
      },
      {
        tool: 'eslint',
        path: 'eslint[0].rules.no-debugger',
        value: '"error"',
        reason: 'base-config',
        template: 'qoq-eslint-v9-ts',
      },
      {
        tool: 'eslint',
        path: 'eslint[0].rules.quotes',
        value: '[2,"single"]',
        reason: 'base-config',
        template: 'qoq-eslint-v9-ts',
      },
    ]);
  });

  it('should not flag eslint rules that differ from the base config', () => {
    const config: QoqConfig = {
      eslint: [{ template: 'qoq-eslint-v9-ts', rules: { 'no-console': 'error' } }],
    };

    expect(collectRedundancies(config, { 0: { 'no-console': 'off' } })).toEqual([]);
  });

  it('should skip eslint entries with no resolved base rules', () => {
    const config: QoqConfig = {
      eslint: [{ template: 'qoq-eslint-v9-ts', rules: { 'no-console': 'off' } }],
    };

    expect(collectRedundancies(config, {})).toEqual([]);
  });

  it('should compare each eslint entry against its own template base rules by index', () => {
    const config: QoqConfig = {
      eslint: [
        { template: 'qoq-eslint-v9-ts', rules: { 'no-console': 'off' } },
        { template: 'qoq-eslint-v9-ts-vitest', rules: { 'no-console': 'off' } },
      ],
    };

    // Same rule, but only entry 0's template already turns it off — entry 1's
    // template sets it to error, so entry 1 is not redundant.
    const warnings = collectRedundancies(config, {
      0: { 'no-console': 'off' },
      1: { 'no-console': 'error' },
    });

    expect(warnings).toEqual([
      {
        tool: 'eslint',
        path: 'eslint[0].rules.no-console',
        value: '"off"',
        reason: 'base-config',
        template: 'qoq-eslint-v9-ts',
      },
    ]);
  });

  it('should detect redundancy across multiple tools in one pass', () => {
    const config: QoqConfig = {
      npm: { checkOutdatedEvery: 1 },
      jscpd: { threshold: 2 },
      stylelint: { strict: false, template: 'qoq-stylelint-css' },
      // Default path, but must not be flagged — it is skillslint's activation key.
      skillslint: { path: './skills' },
      eslint: [{ template: 'qoq-eslint-v9-js', rules: { 'no-console': 'off' } }],
    };

    const warnings = collectRedundancies(config, { 0: { 'no-console': 'off' } });

    expect(warnings.map((warning) => warning.path)).toEqual([
      'npm.checkOutdatedEvery',
      'jscpd.threshold',
      'stylelint.strict',
      'eslint[0].rules.no-console',
    ]);
  });
});
