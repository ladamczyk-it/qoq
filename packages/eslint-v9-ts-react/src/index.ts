import reactPlugin from '@eslint-react/eslint-plugin';
import {
  EslintConfig,
  REACT_ONLY_SONARJS_RULES,
  restoreSonarjsRules,
} from '@ladamczyk/qoq-eslint-v9-js';
import {
  NO_MULTI_COMP_RULE_NAME,
  baseConfig as jsReactBaseConfig,
  disabledRules,
} from '@ladamczyk/qoq-eslint-v9-js-react';
import { baseConfig as tsBaseConfig } from '@ladamczyk/qoq-eslint-v9-ts';
import { objectMergeRight } from '@ladamczyk/qoq-utils';

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
