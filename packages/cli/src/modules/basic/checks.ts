import isEqual from 'react-fast-compare';

import { QoqConfig } from '../../helpers/types.ts';
import { JscpdConfigHandler } from '../jscpd/JscpdConfigHandler.ts';
import { NpmConfigHandler } from '../npm/NpmConfigHandler.ts';

// Stylelint has no dedicated default constant — `strict` simply defaults to false
// in both StylelintConfigHandler.getModulesFromConfig branches.
const STYLELINT_DEFAULT_STRICT = false;

type TRuleSeverity = 0 | 1 | 2 | 'off' | 'warn' | 'error' | (string & {});
type TRuleEntry = TRuleSeverity | [TRuleSeverity, ...unknown[]];
export type TRulesRecord = Record<string, TRuleEntry>;

type TRedundancyReason = 'default' | 'base-config';

export interface IRedundancyWarning {
  tool: string;
  path: string;
  value: string;
  reason: TRedundancyReason;
  // Only set for `base-config` warnings — the qoq-eslint-v9-* template the rule
  // is already declared in.
  template?: string;
}

const NUMERIC_SEVERITY: Record<number, string> = { 0: 'off', 1: 'warn', 2: 'error' };

// Collapse ESLint's interchangeable severities to a single canonical string so a
// user-supplied `0`/`'off'` compares equal to a template's `'off'`/`0`.
const normalizeSeverity = (severity: unknown): string | undefined => {
  if (typeof severity === 'number') {
    return NUMERIC_SEVERITY[severity];
  }

  if (typeof severity === 'string') {
    return severity.toLowerCase();
  }

  return undefined;
};

// Normalize a rule entry to `[severity, ...options]` with a canonical severity so
// shorthand (`'off'`) and array (`['off']`) forms compare equal.
export const normalizeRuleEntry = (entry: unknown): [string | undefined, ...unknown[]] => {
  const [severity, ...options] = Array.isArray(entry) ? entry : [entry];

  return [normalizeSeverity(severity), ...options];
};

export const areRulesEqual = (a: unknown, b: unknown): boolean =>
  isEqual(normalizeRuleEntry(a), normalizeRuleEntry(b));

const formatValue = (value: unknown): string => JSON.stringify(value);

const defaultWarning = (tool: string, path: string, value: unknown): IRedundancyWarning => ({
  tool,
  path,
  value: formatValue(value),
  reason: 'default',
});

// Compare each user-authored tool block against the defaults applied in the
// matching getModulesFromConfig, plus each ESLint rule against the base rules of
// the qoq-eslint-v9-* template that entry declares.
export const collectRedundancies = (
  config: QoqConfig,
  baseRulesByIndex: Record<number, TRulesRecord | undefined> = {}
): IRedundancyWarning[] => {
  const warnings: IRedundancyWarning[] = [];

  if (config.npm?.checkOutdatedEvery === NpmConfigHandler.DEFAULT_CHECK_OUTDATED_EVERY) {
    warnings.push(defaultWarning('npm', 'npm.checkOutdatedEvery', config.npm.checkOutdatedEvery));
  }

  if (config.jscpd?.threshold === JscpdConfigHandler.DEFAULT_THRESHOLD) {
    warnings.push(defaultWarning('jscpd', 'jscpd.threshold', config.jscpd.threshold));
  }

  // `stylelint` is an optional tool, but `strict` is not what activates it — its
  // `template`/`pattern` is. So `strict: false` is safely droppable while the block
  // (and the check) stays alive, which makes it genuinely redundant.
  if (config.stylelint?.strict === STYLELINT_DEFAULT_STRICT) {
    warnings.push(defaultWarning('stylelint', 'stylelint.strict', config.stylelint.strict));
  }

  // Deliberately NOT checking `skillslint.path`: skillslint is an optional tool
  // activated solely by its block, and `path` is the required activating key —
  // remove it and the check can no longer run. Equal to the default or not, it is
  // mandatory, so it is never redundant. The same exemption applies to any future
  // optional tool's activation key.

  (config.eslint ?? []).forEach((entry, index) => {
    const baseRules = baseRulesByIndex[index];
    const rules = entry.rules as TRulesRecord | undefined;
    const { template } = entry;

    // Without a template there are no resolved base rules to compare against, so
    // the guard also narrows `template` to a defined string for the warning below.
    if (!baseRules || !rules || !template) {
      return;
    }

    Object.keys(rules).forEach((ruleName) => {
      if (
        Object.hasOwn(baseRules, ruleName) &&
        areRulesEqual(rules[ruleName], baseRules[ruleName])
      ) {
        warnings.push({
          tool: 'eslint',
          path: `eslint[${index}].rules.${ruleName}`,
          value: formatValue(rules[ruleName]),
          reason: 'base-config',
          template,
        });
      }
    });
  });

  return warnings;
};
