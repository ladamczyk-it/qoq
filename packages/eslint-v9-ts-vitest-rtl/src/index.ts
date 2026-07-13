import { EslintConfig } from '@ladamczyk/qoq-eslint-v9-js';
import {
  baseConfig as jsVitestRtlBaseConfig,
  disabledRules,
} from '@ladamczyk/qoq-eslint-v9-js-vitest-rtl';
import { baseConfig as tsBaseConfig } from '@ladamczyk/qoq-eslint-v9-ts-vitest';
import { objectMergeRight } from '@ladamczyk/qoq-utils';

const { plugins: jsVitestRtlBaseConfigPlugins, ...jsVitestRtlBaseConfigRest } =
  jsVitestRtlBaseConfig;
const { plugins: tsBaseConfigPlugins, ...tsBaseConfigRest } = tsBaseConfig;

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsVitestRtlBaseConfigRest, tsBaseConfigRest, {
    name: 'qoq-eslint-v9-ts-vitest-rtl',
    rules: { ...disabledRules },
  }),
  plugins: { ...jsVitestRtlBaseConfigPlugins, ...tsBaseConfigPlugins },
};
