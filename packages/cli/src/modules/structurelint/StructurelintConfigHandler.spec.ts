import { dummyModulesConfig } from '__tests__/common.ts';
import prompts from 'prompts';
import { describe, it, expect } from 'vitest';

import { StructurelintConfigHandler } from './StructurelintConfigHandler.ts';

describe('StructurelintConfigHandler', () => {
  const configHandler = new StructurelintConfigHandler(dummyModulesConfig, {});

  describe('getConfigFromModules', () => {
    it('should return the config for modules', () => {
      expect(configHandler.getConfigFromModules()).toStrictEqual({});
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

    it('should read the structurelint path from config when present', () => {
      const handler = new StructurelintConfigHandler(structuredClone(dummyModulesConfig), {
        structurelint: { path: 'src' },
      });

      expect(handler.getModulesFromConfig().modules.structurelint).toStrictEqual({
        path: 'src',
      });
    });
  });

  describe('getPrompts', () => {
    it('should not register a structurelint module when the user declines', async () => {
      prompts.inject([false]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new StructurelintConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(modulesConfig.modules.structurelint).toBeUndefined();
    });

    it('should store the provided path when the user opts in', async () => {
      prompts.inject([true, 'src']);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new StructurelintConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(modulesConfig.modules.structurelint).toStrictEqual({ path: 'src' });
    });
  });

  describe('minimal config from wizard defaults', () => {
    it('emits an empty config when the user declines structure linting', async () => {
      prompts.inject([false]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new StructurelintConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(handler.getConfigFromModules()).toStrictEqual({});
    });

    it('serializes the path when the user opts in', async () => {
      prompts.inject([true, StructurelintConfigHandler.DEFAULT_PATH]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new StructurelintConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(handler.getConfigFromModules()).toStrictEqual({
        structurelint: { path: StructurelintConfigHandler.DEFAULT_PATH },
      });
    });
  });

  describe('getPackages', () => {
    it('should expose the structurelint package', () => {
      expect(configHandler.getPackages()).toStrictEqual(['@ladamczyk/structurelint']);
    });
  });
});
