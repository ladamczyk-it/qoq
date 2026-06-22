/* eslint-disable @typescript-eslint/no-unsafe-call */
import c from 'picocolors';
import prompts from 'prompts';

import { QoqConfig } from '../../helpers/types.ts';
import { AbstractConfigHandler } from '../abstract/AbstractConfigHandler.ts';
import { IModulesConfig } from '../types.ts';

export class NpmConfigHandler extends AbstractConfigHandler {
  static readonly DEFAULT_CHECK_OUTDATED_EVERY = 1;

  async getPrompts(): Promise<void> {
    const {
      npmSchedule,
    }: {
      npmSchedule: number;
    } = await prompts.prompt([
      {
        type: 'number',
        name: 'npmSchedule',
        initial: NpmConfigHandler.DEFAULT_CHECK_OUTDATED_EVERY,
        message: c.reset(`How often should we check dependencies? (in days, 0 means in every run)`),
        validate: (npmSchedule: number) => (npmSchedule < 0 ? `Schedule must be >= 0` : true),
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

    if (
      npm &&
      Number(npm.checkOutdatedEvery) >= 0 &&
      Number(npm.checkOutdatedEvery) !== NpmConfigHandler.DEFAULT_CHECK_OUTDATED_EVERY
    ) {
      this.config.npm = { ...npm };
    }

    return super.getConfigFromModules();
  }

  getModulesFromConfig(): IModulesConfig {
    const { modules } = this.modulesConfig;

    modules.npm = {
      checkOutdatedEvery:
        this.config.npm?.checkOutdatedEvery ?? NpmConfigHandler.DEFAULT_CHECK_OUTDATED_EVERY,
    };

    return super.getModulesFromConfig();
  }
}
