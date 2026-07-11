import { EModulesEslint } from './eslint/types.ts';
import { IModulesConfig } from './types.ts';

export const configUsesTs = (modules: IModulesConfig['modules']): boolean =>
  (modules.eslint ?? []).some(
    (config) =>
      config.template === EModulesEslint.ESLINT_V9_TS ||
      config.template === EModulesEslint.ESLINT_V9_TS_JEST ||
      config.template === EModulesEslint.ESLINT_V9_TS_REACT ||
      config.template === EModulesEslint.ESLINT_V9_TS_VITEST
  );

export const configUsesReact = (modules: IModulesConfig['modules']): boolean =>
  (modules.eslint ?? []).some(
    (config) =>
      config.template === EModulesEslint.ESLINT_V9_JS_REACT ||
      config.template === EModulesEslint.ESLINT_V9_TS_REACT
  );

export const getFilesExtensions = (modules: IModulesConfig['modules']): string[] => {
  if (configUsesTs(modules) && configUsesReact(modules)) {
    return ['js', 'jsx', 'ts', 'tsx'];
  }

  if (configUsesTs(modules)) {
    return ['ts'];
  }

  if (configUsesReact(modules)) {
    return ['js', 'jsx'];
  }

  return ['js'];
};
