import prompts from 'prompts';
import { describe, it, expect } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { NpmConfigHandler } from './NpmConfigHandler.ts';

describe('NpmConfigHandler', () => {
  const configHandler = new NpmConfigHandler(dummyModulesConfig, {});

  describe('getConfigFromModules', () => {
    it('should return the config for modules', () => {
      expect(configHandler.getConfigFromModules()).toStrictEqual({});
    });

    it('should serialize a configured npm schedule', () => {
      const handler = new NpmConfigHandler(
        { ...structuredClone(dummyModulesConfig), modules: { npm: { checkOutdatedEvery: 7 } } },
        {}
      );

      expect(handler.getConfigFromModules()).toStrictEqual({ npm: { checkOutdatedEvery: 7 } });
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
        modules: {
          npm: {
            checkOutdatedEvery: 1,
          },
        },
        srcPath: '',
      });
    });

    it('should read the schedule from config when present', () => {
      const handler = new NpmConfigHandler(structuredClone(dummyModulesConfig), {
        npm: { checkOutdatedEvery: 5 },
      });

      expect(handler.getModulesFromConfig().modules.npm).toStrictEqual({ checkOutdatedEvery: 5 });
    });
  });

  describe('getPrompts', () => {
    it('should store the answered schedule on the modules config', async () => {
      prompts.inject([3]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new NpmConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(modulesConfig.modules.npm).toStrictEqual({ checkOutdatedEvery: 3 });
    });
  });

  describe('minimal config from wizard defaults', () => {
    it('omits the schedule when the user accepts the default (1 day)', async () => {
      prompts.inject([1]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new NpmConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      // desired: accepting the default must not bloat qoq.config.js
      // currently RED — getConfigFromModules serializes any truthy `checkOutdatedEvery`
      expect(handler.getConfigFromModules()).toStrictEqual({});
    });

    it('serializes only the schedule when the user changes it', async () => {
      prompts.inject([7]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new NpmConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(handler.getConfigFromModules()).toStrictEqual({ npm: { checkOutdatedEvery: 7 } });
    });
  });
});
