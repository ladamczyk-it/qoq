import { EConfigType, QoqConfig } from '../helpers/types.ts';

import { IModuleEslintConfig } from './eslint/types.ts';
import { IModuleJscpdConfig } from './jscpd/types.ts';
import { IModuleKnipConfig } from './knip/types.ts';
import { IModuleNpmConfig } from './npm/types.ts';
import { IModulePrettierConfig } from './prettier/types.ts';
import { IModuleSkillslintConfig } from './skillslint/types.ts';
import { IModuleStructurelintConfig } from './structurelint/types.ts';
import { TModuleStylelintConfig } from './stylelint/types.ts';

export interface IModulesConfig {
  srcPath: string;
  configType: EConfigType;
  configPaths: {
    prettier: string;
    eslint: string;
    stylelint: string;
  };
  workspaces?: string[];
  // Raw, user-authored qoq.config.* (before defaults are merged in). Kept so the
  // BasicExecutor self-health-check can tell which entries the user actually wrote
  // versus values that getModulesFromConfig filled in from defaults.
  rawConfig?: QoqConfig;
  modules: {
    npm?: IModuleNpmConfig;
    prettier?: IModulePrettierConfig;
    eslint?: IModuleEslintConfig[];
    jscpd?: IModuleJscpdConfig;
    knip?: IModuleKnipConfig;
    stylelint?: TModuleStylelintConfig;
    structurelint?: IModuleStructurelintConfig;
    skillslint?: IModuleSkillslintConfig;
  };
}

export interface IExecuteStagedOptions {
  disableCache?: boolean;
  skipNpm?: boolean;
  skipPrettier?: boolean;
  skipJscpd?: boolean;
  skipKnip?: boolean;
  skipEslint?: boolean;
  skipStylelint?: boolean;
  skipStructurelint?: boolean;
  skipSkillslint?: boolean;
  warmup?: boolean;
  silent?: boolean;
  configHints?: boolean;
  production?: boolean;
  json?: string;
  output: string;
  concurrency?: 'off' | 'auto';
}

export interface IExecuteOptions extends IExecuteStagedOptions {
  init?: boolean;
  fix?: boolean;
}

export interface IExecutorOptions extends IExecuteStagedOptions {
  fix: boolean;
  disableCache: boolean;
  concurrency: 'off' | 'auto';
}
