import { IModuleEslintConfig } from '../modules/eslint/types.ts';
import { TJscpdFormat } from '../modules/jscpd/types.ts';
import { IModuleNpmConfig } from '../modules/npm/types.ts';
import { IModulePrettierConfig } from '../modules/prettier/types.ts';
import { IModuleSkillslintConfig } from '../modules/skillslint/types.ts';
import { TModuleStructurelintConfig } from '../modules/structurelint/types.ts';
import { TModuleStylelintConfig } from '../modules/stylelint/types.ts';

export type TPartialBy<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export enum EConfigType {
  CJS = 'CJS',
  ESM = 'ESM',
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface QoqConfig {
  srcPath?: string;
  // Overrides the CJS/ESM format auto-detected from the consumer's package.json
  // "type" field. Not offered by the wizard — explicit config authoring only.
  configType?: `${EConfigType}`;
  npm?: IModuleNpmConfig;
  prettier?: IModulePrettierConfig;
  eslint?: IModuleEslintConfig[];
  jscpd?: {
    format?: TJscpdFormat[];
    threshold?: number;
    ignore?: string[];
  };
  stylelint?: TModuleStylelintConfig;
  structurelint?: TModuleStructurelintConfig;
  skillslint?: IModuleSkillslintConfig;
  knip?: {
    entry?: string[];
    project?: string[];
    ignore?: string[];
    ignoreDependencies?: string[];
    ignoreBinaries?: string[];
    ignoreFiles?: string[];
    ignoreMembers?: string[];
    ignoreUnresolved?: string[];
  };
  configPaths?: {
    prettier?: string;
    eslint?: string;
    stylelint?: string;
  };
}
