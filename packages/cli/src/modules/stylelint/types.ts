import { StylelintConfig } from '../../../../stylelint-css/src';

export enum EModulesStylelint {
  STYLELINT_CSS = 'qoq-stylelint-css',
  STYLELINT_SCSS = 'qoq-stylelint-scss',
}

interface IModuleStylelintConfig extends StylelintConfig {
  strict: boolean;
}

export interface IModuleStylelintConfigWithTemplate extends IModuleStylelintConfig {
  template?: `${EModulesStylelint}`;
}

export interface IModuleStylelintConfigWithPattern extends IModuleStylelintConfig {
  pattern: string;
}

export type TModuleStylelintConfig =
  | IModuleStylelintConfigWithTemplate
  | IModuleStylelintConfigWithPattern;
