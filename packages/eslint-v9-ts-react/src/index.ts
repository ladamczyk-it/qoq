import reactPlugin from '@eslint-react/eslint-plugin';
import {
  EslintConfig,
  REACT_ONLY_SONARJS_RULES,
  baseConfig as jsBaseConfig,
  restoreSonarjsRules,
} from '@ladamczyk/qoq-eslint-v9-js';
import {
  NO_MULTI_COMP_RULE_NAME,
  baseConfig as jsReactBaseConfig,
  disabledRules,
  reactLayer,
} from '@ladamczyk/qoq-eslint-v9-js-react';
import { baseConfig as tsBaseConfig, tsLayer } from '@ladamczyk/qoq-eslint-v9-ts';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import { defineConfig } from 'eslint/config';

import type { Linter } from 'eslint';

const { plugins: jsReactBaseConfigPlugins, ...jsReactBaseConfigRest } = jsReactBaseConfig;
const { plugins: tsBaseConfigPlugins, ...tsBaseConfigRest } = tsBaseConfig;

// tsBaseConfigRest is merged in after jsReactBaseConfigRest and still carries the
// React/JSX rules disabled (it's built from eslint-v9-js, not eslint-v9-js-react), so
// its "off" wins the objectMergeRight merge unless re-restored here as the final override.
// `no-hook-setter-in-body` is intentionally excluded: it flags the same pattern
// (an unconditional state-setter call in a component's render body) as
// `@eslint-react/set-state-in-render`, which already covers it more broadly.
const restoredReactRules = restoreSonarjsRules(REACT_ONLY_SONARJS_RULES, [
  'no-hook-setter-in-body',
]);

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsReactBaseConfigRest, tsBaseConfigRest, {
    name: 'qoq-eslint-v9-ts-react',
    rules: {
      ...restoredReactRules,
      ...disabledRules,
      ...(reactPlugin.configs['recommended-typescript'].rules ?? {}),
      // Our custom rule lives in (and is registered by) `eslint-v9-js-react`;
      // re-assert it here so it survives the `recommended-typescript` merge.
      [`@eslint-react/${NO_MULTI_COMP_RULE_NAME}`]: 2,
    },
  }),
  plugins: { ...jsReactBaseConfigPlugins, ...tsBaseConfigPlugins },
};

/**
 * The delta this package itself contributes. Under `defineConfig` composition the
 * legacy workarounds above disappear: `tsLayer` is a true delta that never carries
 * the JS base's disabled React-only sonarjs rules, so `reactLayer`'s restorations
 * (and its `@eslint-react/no-multi-comp` enable) are never clobbered — neither
 * `restoredReactRules` nor the `no-multi-comp` re-assertion is re-added here.
 * Only the `recommended-typescript` rules are genuinely this package's own.
 */
export const tsReactLayer: Linter.Config = {
  name: 'qoq-eslint-v9-ts-react',
  // `?? {}` because upstream types `rules` as optional; `Linter.Config` accepts the
  // resulting `Partial<Linter.RulesRecord>` as-is, so no cast is needed here.
  rules: reactPlugin.configs['recommended-typescript'].rules ?? {},
};

/**
 * Flat-config array form: the full chain (JS base → React layer → ts layer →
 * this package's delta), merged per file by ESLint's own cascade instead of being
 * pre-merged with `objectMergeRight`. Composed from delta layers only — a nested
 * `configs.*` would re-apply the JS base mid-chain and clobber `reactLayer`'s
 * sonarjs restorations. `testLayer` is deliberately absent: the legacy merge uses
 * the ts package's `baseConfig`, not its `testConfig`.
 */
export const configs: Record<'base', Linter.Config[]> = {
  base: defineConfig(jsBaseConfig, reactLayer, tsLayer, tsReactLayer),
};
