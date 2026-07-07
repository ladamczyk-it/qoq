import { existsSync, rmSync, writeFileSync } from 'fs';

import c from 'picocolors';

import { QoqConfig } from '../../helpers/types.ts';
import { IModulesConfig } from '../types.ts';

interface IConfigHandler {
  getPrompts: () => Promise<void>;
  getConfigFromModules: () => QoqConfig;
  getModulesFromConfig: () => IModulesConfig;
}
export abstract class AbstractConfigHandler implements IConfigHandler {
  protected modulesConfig: IModulesConfig;
  protected config: QoqConfig;
  protected packages: string[] = [];
  private nextHandler: AbstractConfigHandler;

  constructor(modulesConfig: IModulesConfig, config: QoqConfig) {
    this.modulesConfig = modulesConfig;
    this.config = config;
  }

  async getPrompts(): Promise<void> {
    if (this.nextHandler) {
      return this.nextHandler.getPrompts();
    }

    return Promise.resolve();
  }

  getConfigFromModules(): QoqConfig {
    if (this.nextHandler) {
      return this.nextHandler.getConfigFromModules();
    }

    return this.config;
  }

  getModulesFromConfig(): IModulesConfig {
    if (this.nextHandler) {
      return this.nextHandler.getModulesFromConfig();
    }

    return this.modulesConfig;
  }

  setNext(handler: AbstractConfigHandler): AbstractConfigHandler {
    this.nextHandler = handler;

    return handler;
  }

  getPackages(): string[] {
    if (this.nextHandler) {
      return [...this.packages, ...this.nextHandler.getPackages()];
    }

    return this.packages;
  }

  // Shared by every handler that owns a dedicated config file (Eslint, Prettier,
  // Stylelint): the static CONFIG_FILE_PATH they declare, looked up the same way
  // AbstractExecutor.prepare() resolves a subclass's static CACHE_PATH.
  protected getConfigFilePath(): string {
    const configFilePath = (this.constructor as { CONFIG_FILE_PATH?: string }).CONFIG_FILE_PATH;

    if (!configFilePath) {
      throw new Error('No config file path for handler defined!');
    }

    return configFilePath;
  }

  protected configFileExists(): boolean {
    return existsSync(this.getConfigFilePath());
  }

  protected warnIfConfigFileExists(): void {
    if (this.configFileExists()) {
      const displayName = this.getConfigFilePath().replace(/^\//, '');

      process.stdout.write(
        c.red(
          `\n '${displayName}' already exists in the project root, config will be overwritten by this setup!\n\n`
        )
      );
    }
  }

  protected writeConfigFile(content: string): void {
    const configFilePath = this.getConfigFilePath();

    if (this.configFileExists()) {
      rmSync(configFilePath);
    }

    writeFileSync(configFilePath, content);
  }
}
