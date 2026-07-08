/* eslint-disable @typescript-eslint/no-unsafe-call */
import { readFileSync } from 'fs';

import c from 'picocolors';
import prompts from 'prompts';
import isEqual from 'react-fast-compare';

import { QoqConfig } from '../../helpers/types.ts';
import { AbstractConfigHandler } from '../abstract/AbstractConfigHandler.ts';
import { IModulesConfig } from '../types.ts';

import { EModulesPrettier } from './types.ts';

export class PrettierConfigHandler extends AbstractConfigHandler {
  static readonly CONFIG_FILE_PATH = '/.prettierrc';

  async getPrompts(): Promise<void> {
    this.warnIfConfigFileExists();

    const {
      prettierPackage,
      prettierSources,
    }: {
      prettierPackage: EModulesPrettier;
      prettierSources: string[];
    } = await prompts.prompt([
      {
        type: 'select',
        name: 'prettierPackage',
        message: c.reset(`What options should we use for ${c.green('Prettier')}?`),
        choices: [
          { title: 'Basic Prettier', value: EModulesPrettier.PRETTIER },
          { title: 'Prettier with JSON sort', value: EModulesPrettier.PRETTIER_WITH_JSON_SORT },
        ],
      },
      {
        type: 'toggle',
        name: 'otherSources',
        message: 'Should we format other paths than sources?',
        initial: false,
        active: c.green('yes'),
        inactive: c.red('no'),
      },
      {
        type: (prev: boolean) => (prev ? 'list' : null),
        name: 'prettierSources',
        message: 'Provide paths (from project root dir), space " " separated',
        separator: ' ',
      },
    ]);

    this.writeConfigFile(`"${prettierPackage}"`);

    const { srcPath } = this.modulesConfig;

    this.modulesConfig.modules.prettier = {
      sources: prettierSources ? prettierSources.filter((entry) => !!entry) : [srcPath],
    };

    return super.getPrompts();
  }

  getConfigFromModules(): QoqConfig {
    const {
      srcPath,
      modules: { prettier },
    } = this.modulesConfig;

    if (prettier?.sources && !isEqual(prettier.sources, [srcPath])) {
      this.config.prettier = { ...prettier };
    }

    return super.getConfigFromModules();
  }

  getModulesFromConfig(): IModulesConfig {
    const { srcPath, modules } = this.modulesConfig;

    modules.prettier = {
      sources: this.config.prettier?.sources ?? [srcPath],
    };

    return super.getModulesFromConfig();
  }

  getPackages(): string[] {
    if (this.configFileExists()) {
      try {
        const configFileContent = readFileSync(PrettierConfigHandler.CONFIG_FILE_PATH, 'utf-8');

        this.packages = [
          `@ladamczyk/${
            configFileContent.includes(EModulesPrettier.PRETTIER_WITH_JSON_SORT)
              ? EModulesPrettier.PRETTIER_WITH_JSON_SORT
              : EModulesPrettier.PRETTIER
          }`,
        ];
      } catch {
        this.packages = [`@ladamczyk/${EModulesPrettier.PRETTIER}`];
      }
    } else {
      this.packages = [`@ladamczyk/${EModulesPrettier.PRETTIER}`];
    }

    return super.getPackages();
  }
}
