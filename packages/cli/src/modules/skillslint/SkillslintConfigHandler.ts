/* eslint-disable @typescript-eslint/no-unsafe-call */
import c from 'picocolors';
import prompts from 'prompts';

import { AbstractConfigHandler } from '../abstract/AbstractConfigHandler.ts';
import { IModulesConfig } from '../types.ts';

export class SkillslintConfigHandler extends AbstractConfigHandler {
  static readonly DEFAULT_SKILLS_PATH = './skills';

  async getPrompts(): Promise<void> {
    const {
      skillslint,
    }: {
      skillslint: boolean;
    } = await prompts.prompt([
      {
        type: 'toggle',
        name: 'skillslint',
        message: 'Should we include agents skills linting?',
        initial: false,
        active: c.green('yes'),
        inactive: c.red('no'),
      },
    ]);

    if (!skillslint) {
      return super.getPrompts();
    }

    const {
      skillslintPath,
    }: {
      skillslintPath: string;
    } = await prompts.prompt([
      {
        type: 'text',
        name: 'skillslintPath',
        message: c.reset(`Where do You have agents skills?`),
        initial: SkillslintConfigHandler.DEFAULT_SKILLS_PATH,
      },
    ]);

    this.modulesConfig.modules.skillslint = {
      path: skillslintPath,
    };

    return super.getPrompts();
  }

  getModulesFromConfig(): IModulesConfig {
    const { modules } = this.modulesConfig;
    const { skillslint } = this.config;

    if (skillslint) {
      const { path } = skillslint;

      modules.skillslint = {
        path,
      };
    }

    return super.getModulesFromConfig();
  }

  getPackages(): string[] {
    this.packages = ['@ladamczyk/skillslint'];

    return super.getPackages();
  }
}
