import { EConfigType } from '../helpers/types.ts';
import { IModulesConfig } from '../modules/types.ts';

export const dummyModulesConfig: IModulesConfig = {
  srcPath: '',
  configType: EConfigType.ESM,
  modules: {},
  configPaths: {
    eslint: './eslint.config.js',
    prettier: './.prettierrc',
    stylelint: './stylelint.config.js',
  },
};
