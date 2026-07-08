import { StylelintConfig } from '@ladamczyk/qoq-stylelint-css';

export enum EModulesStylelint {
  STYLELINT_CSS = 'qoq-stylelint-css',
  STYLELINT_SCSS = 'qoq-stylelint-scss',
}

interface IModuleStylelintConfig extends StylelintConfig {
  strict?: boolean;
}

interface IModuleStylelintConfigWithTemplate extends IModuleStylelintConfig {
  template?: `${EModulesStylelint}`;
}

interface IModuleStylelintConfigWithPattern extends IModuleStylelintConfig {
  pattern: string;
}

export type TModuleStylelintConfig =
  IModuleStylelintConfigWithTemplate | IModuleStylelintConfigWithPattern;
