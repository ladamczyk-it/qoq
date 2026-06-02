import { EslintConfig } from '@ladamczyk/qoq-eslint-v9-js';

import { TPartialBy } from '../../helpers/types.ts';

export enum EModulesEslint {
  ESLINT_V9_JS = 'qoq-eslint-v9-js',
  ESLINT_V9_JS_JEST = 'qoq-eslint-v9-js-jest',
  ESLINT_V9_JS_JEST_RTL = 'qoq-eslint-v9-js-jest-rtl',
  ESLINT_V9_JS_REACT = 'qoq-eslint-v9-js-react',
  ESLINT_V9_JS_VITEST = 'qoq-eslint-v9-js-vitest',
  ESLINT_V9_JS_VITEST_RTL = 'qoq-eslint-v9-js-vitest-rtl',
  ESLINT_V9_TS = 'qoq-eslint-v9-ts',
  ESLINT_V9_TS_JEST = 'qoq-eslint-v9-ts-jest',
  ESLINT_V9_TS_JEST_RTL = 'qoq-eslint-v9-ts-jest-rtl',
  ESLINT_V9_TS_REACT = 'qoq-eslint-v9-ts-react',
  ESLINT_V9_TS_VITEST = 'qoq-eslint-v9-ts-vitest',
  ESLINT_V9_TS_VITEST_RTL = 'qoq-eslint-v9-ts-vitest-rtl',
}

export interface IModuleEslintConfig extends TPartialBy<EslintConfig, 'rules'> {
  template?: EModulesEslint;
}
