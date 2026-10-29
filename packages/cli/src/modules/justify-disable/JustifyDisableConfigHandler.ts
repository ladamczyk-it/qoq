import { QoqConfig } from '../../helpers/types.ts';
import { AbstractConfigHandler } from '../abstract/AbstractConfigHandler.ts';
import { IModulesConfig } from '../types.ts';

export class JustifyDisableConfigHandler extends AbstractConfigHandler {
  getPrompts(): Promise<void> {
    return Promise.resolve();
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
}
