/* eslint-disable @typescript-eslint/no-unsafe-call */
import prompts from 'prompts';

import { QoqConfig } from '../../helpers/types.ts';
import { AbstractConfigHandler } from '../abstract/AbstractConfigHandler.ts';
import { IModulesConfig } from '../types.ts';

export class JustifyDisableConfigHandler extends AbstractConfigHandler {
  async getPrompts(): Promise<void> {
    const {
      justifyDisable,
    }: {
      justifyDisable?: 'off' | 'warn' | 'error';
    } = await prompts.prompt([
      {
        type: 'select',
        name: 'justifyDisable',
        message:
          'Should we require a @todo justification for every eslint/stylelint disable comment?',
        choices: [
          { title: 'off', value: 'off' },
          { title: 'warn', value: 'warn' },
          { title: 'error', value: 'error' },
        ],
        initial: 0,
      },
    ]);

    // A cancelled prompt leaves the answer undefined; only warn/error write a block.
    if (justifyDisable !== 'warn' && justifyDisable !== 'error') {
      return;
    }

    this.modulesConfig.modules.justifyDisable = { severity: justifyDisable };
  }

  getConfigFromModules(): QoqConfig {
    const {
      modules: { justifyDisable },
    } = this.modulesConfig;

    if (justifyDisable) {
      this.config.justifyDisable = justifyDisable;
    }

    return super.getConfigFromModules();
  }

  getModulesFromConfig(): IModulesConfig {
    const { modules } = this.modulesConfig;
    const { justifyDisable } = this.config;

    if (justifyDisable) {
      modules.justifyDisable = justifyDisable;
    }

    return super.getModulesFromConfig();
  }

  /**
   * Unlike the structurelint and skillslint handlers, the package is installed
   * only when the block is set: `off` writes no config, so installing it would
   * leave an unused dependency.
   */
  getPackages(): string[] {
    if (this.modulesConfig.modules.justifyDisable) {
      this.packages = ['@ladamczyk/justify-disable'];
    }

    return super.getPackages();
  }
}
