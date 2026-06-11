/* eslint-disable @typescript-eslint/no-unsafe-call */
import c from 'picocolors';
import prompts from 'prompts';

import { QoqConfig } from '../../helpers/types.ts';
import { AbstractConfigHandler } from '../abstract/AbstractConfigHandler.ts';
import { IModulesConfig } from '../types.ts';

export class NpmConfigHandler extends AbstractConfigHandler {
  async getPrompts(): Promise<void> {
    const {
      npmSchedule,
    }: {
      npmSchedule: number;
    } = await prompts.prompt([
      {
        type: 'number',
        name: 'npmSchedule',
        initial: 1,
        message: c.reset(`How often should we check dependencies? (in days, 0 means in every run)`),
        validate: (npmSchedule: number) => (npmSchedule < 0 ? `Schedule must me => 0` : true),
      },
    ]);

    this.modulesConfig.modules.npm = {
      checkOutdatedEvery: npmSchedule,
    };

    return super.getPrompts();
  }

  getConfigFromModules(): QoqConfig {
    const {
      modules: { npm },
    } = this.modulesConfig;

    if (npm?.checkOutdatedEvery && Number(npm.checkOutdatedEvery) >= 0) {
      this.config.npm = { ...npm };
    }

    return super.getConfigFromModules();
  }

  getModulesFromConfig(): IModulesConfig {
    const { modules } = this.modulesConfig;

    modules.npm = {
      checkOutdatedEvery: this.config.npm?.checkOutdatedEvery ?? 1,
    };

    return super.getModulesFromConfig();
  }
}
