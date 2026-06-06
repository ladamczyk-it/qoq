import { dummyModulesConfig } from '__tests__/common.ts';
import prompts from 'prompts';
import { describe, it, expect } from 'vitest';

import { EConfigType } from '../../helpers/types.ts';

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

  describe('getPackages', () => {
    it('should expose the cli package', () => {
      expect(configHandler.getPackages()).toStrictEqual(['@ladamczyk/qoq-cli']);
    });
  });
});
