import { dummyModulesConfig } from '__tests__/common.ts';
import prompts from 'prompts';
import { describe, it, expect } from 'vitest';

import { EConfigType } from '../../helpers/types.ts';
import { EslintConfigHandler } from '../eslint/EslintConfigHandler.ts';
import { PrettierConfigHandler } from '../prettier/PrettierConfigHandler.ts';
import { StylelintConfigHandler } from '../stylelint/StylelintConfigHandler.ts';

import { BasicConfigHandler } from './BasicConfigHandler.ts';

describe('BasicConfigHandler', () => {
  const configHandler = new BasicConfigHandler(dummyModulesConfig, {});

  describe('getConfigFromModules', () => {
    it('should return the config for modules', () => {
      expect(configHandler.getConfigFromModules()).toStrictEqual({
        configPaths: {
          eslint: './eslint.config.js',
          prettier: './.prettierrc',
          stylelint: './stylelint.config.js',
        },
        srcPath: '',
      });
    });
  });

  describe('getModulesFromConfig', () => {
    it('should return the modules from config', () => {
      expect(configHandler.getModulesFromConfig()).toStrictEqual({
        configPaths: {
          eslint: './eslint.config.js',
          prettier: './.prettierrc',
          stylelint: './stylelint.config.js',
        },
        configType: 'ESM',
        modules: {},
        srcPath: '',
      });
    });
  });

  describe('getPrompts', () => {
    it('should store the answered source path and config type', async () => {
      prompts.inject(['app', EConfigType.CJS]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new BasicConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(modulesConfig.srcPath).toBe('app');
      expect(modulesConfig.configType).toBe(EConfigType.CJS);
    });
  });

  describe('getConfigFromModules with the default source path', () => {
    it('should omit the source path when it matches the default', () => {
      const handler = new BasicConfigHandler(
        { ...structuredClone(dummyModulesConfig), srcPath: './src' },
        {}
      );

      expect(handler.getConfigFromModules()).not.toHaveProperty('srcPath');
    });
  });

  describe('minimal config from wizard defaults', () => {
    const canonicalConfigPaths = {
      eslint: EslintConfigHandler.CONFIG_FILE_PATH,
      prettier: PrettierConfigHandler.CONFIG_FILE_PATH,
      stylelint: StylelintConfigHandler.CONFIG_FILE_PATH,
    };

    it('emits an empty config when the user accepts the default source path', async () => {
      prompts.inject(['./src', EConfigType.ESM]);
      const modulesConfig = {
        ...structuredClone(dummyModulesConfig),
        configPaths: { ...canonicalConfigPaths },
      };
      const handler = new BasicConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(handler.getConfigFromModules()).toStrictEqual({});
    });

    it('serializes only the source path when the user changes it', async () => {
      prompts.inject(['app', EConfigType.ESM]);
      const modulesConfig = {
        ...structuredClone(dummyModulesConfig),
        configPaths: { ...canonicalConfigPaths },
      };
      const handler = new BasicConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(handler.getConfigFromModules()).toStrictEqual({ srcPath: 'app' });
    });
  });

  describe('getModulesFromConfig with an explicit configType override', () => {
    it('should prefer the config value over package.json auto-detection', () => {
      // This package's own package.json has "type": "module", so auto-detection
      // would otherwise resolve to ESM — CJS here only holds if the override wins.
      const handler = new BasicConfigHandler(structuredClone(dummyModulesConfig), {
        configType: EConfigType.CJS,
      });

      expect(handler.getModulesFromConfig().configType).toBe(EConfigType.CJS);
    });

    it('should accept a plain string and map it back to EConfigType', () => {
      const handler = new BasicConfigHandler(structuredClone(dummyModulesConfig), {
        configType: 'CJS',
      });

      expect(handler.getModulesFromConfig().configType).toBe(EConfigType.CJS);
    });
  });

  describe('getPackages', () => {
    it('should expose the cli package', () => {
      expect(configHandler.getPackages()).toStrictEqual(['@ladamczyk/qoq-cli']);
    });
  });
});
