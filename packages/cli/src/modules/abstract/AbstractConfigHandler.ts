import { existsSync, rmSync, writeFileSync } from 'fs';

import c from 'picocolors';

import { QoqConfig } from '../../helpers/types.ts';
import { IModulesConfig } from '../types.ts';

interface IConfigHandler {
  getPrompts: () => Promise<void>;
  getConfigFromModules: () => QoqConfig;
  getModulesFromConfig: () => IModulesConfig;
}
// Every handler reads and writes the same `modulesConfig` / `config` pair it was
// constructed with; running them all is the caller's job (see
// getHandlersBySequence() in ../index.ts), which is why nothing here delegates
// onward. Each method returns the shared object so a subclass can end on
// `super.getX()` without caring where it sits in the sequence.
export abstract class AbstractConfigHandler implements IConfigHandler {
  protected modulesConfig: IModulesConfig;
  protected config: QoqConfig;
  protected packages: string[] = [];

  constructor(modulesConfig: IModulesConfig, config: QoqConfig) {
    this.modulesConfig = modulesConfig;
    this.config = config;
  }

  // Every handler asks the wizard something; there is no sensible default and
  // nothing to hand back, so the base declares it rather than implementing it.
  abstract getPrompts(): Promise<void>;

  getConfigFromModules(): QoqConfig {
    return this.config;
  }

  getModulesFromConfig(): IModulesConfig {
    return this.modulesConfig;
  }

  getPackages(): string[] {
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
