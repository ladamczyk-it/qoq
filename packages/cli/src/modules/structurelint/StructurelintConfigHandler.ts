/* eslint-disable @typescript-eslint/no-unsafe-call */
import c from 'picocolors';
import prompts from 'prompts';

import { QoqConfig } from '../../helpers/types.ts';
import { AbstractConfigHandler } from '../abstract/AbstractConfigHandler.ts';
import { IModulesConfig } from '../types.ts';

export class StructurelintConfigHandler extends AbstractConfigHandler {
  static readonly DEFAULT_PATH = '.';

  async getPrompts(): Promise<void> {
    const {
      structurelint,
    }: {
      structurelint: boolean;
    } = await prompts.prompt([
      {
        type: 'toggle',
        name: 'structurelint',
        message: 'Should we include project file/folder structure linting?',
        initial: false,
        active: c.green('yes'),
        inactive: c.red('no'),
      },
    ]);

    if (!structurelint) {
      return super.getPrompts();
    }

    const {
      structurelintPath,
    }: {
      structurelintPath: string;
    } = await prompts.prompt([
      {
        type: 'text',
        name: 'structurelintPath',
        message: c.reset(`Which folder should ${c.green('Structurelint')} validate?`),
        initial: StructurelintConfigHandler.DEFAULT_PATH,
      },
    ]);

    this.modulesConfig.modules.structurelint = {
      path: structurelintPath,
    };

    return super.getPrompts();
  }

  getConfigFromModules(): QoqConfig {
    const {
      modules: { structurelint },
    } = this.modulesConfig;

    if (structurelint) {
      this.config.structurelint = { path: structurelint.path };
    }

    return super.getConfigFromModules();
  }

  getModulesFromConfig(): IModulesConfig {
    const { modules } = this.modulesConfig;
    const { structurelint } = this.config;

    if (structurelint) {
      const { path } = structurelint;

      modules.structurelint = {
        path,
      };
    }

    return super.getModulesFromConfig();
  }

  getPackages(): string[] {
    this.packages = ['@ladamczyk/structurelint'];

    return super.getPackages();
  }
}
