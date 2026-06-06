import { dummyModulesConfig } from '__tests__/common.ts';
import prompts from 'prompts';
import { describe, it, expect } from 'vitest';

import { JscpdConfigHandler } from './JscpdConfigHandler.ts';

describe('JscpdConfigHandler', () => {
  const configHandler = new JscpdConfigHandler(dummyModulesConfig, {});

  describe('getConfigFromModules', () => {
    it('should return the config for modules', () => {
      expect(configHandler.getConfigFromModules()).toStrictEqual({
        jscpd: {
          format: undefined,
        },
      });
    });

    it('should keep non-default threshold and ignore values', () => {
      const handler = new JscpdConfigHandler(
        {
          ...structuredClone(dummyModulesConfig),
          modules: { jscpd: { format: ['typescript'], threshold: 5, ignore: ['dist'] } },
        },
        {}
      );

      expect(handler.getConfigFromModules()).toStrictEqual({
        jscpd: { format: ['typescript'], threshold: 5, ignore: ['dist'] },
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
        modules: {
          jscpd: {
            format: ['javascript'],
            ignore: ['**/*.spec.js'],
            threshold: 2,
          },
        },
        srcPath: '',
      });
    });
  });

  describe('getPrompts', () => {
    it('should store the answered threshold, format and ignore values', async () => {
      prompts.inject([3, ['typescript'], ['**/*.spec.ts']]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new JscpdConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(modulesConfig.modules.jscpd).toStrictEqual({
        threshold: 3,
        format: ['typescript'],
        ignore: ['**/*.spec.ts'],
      });
    });
  });

  describe('getPackages', () => {
    it('should expose the jscpd package', () => {
      expect(configHandler.getPackages()).toStrictEqual(['@ladamczyk/qoq-jscpd']);
    });
  });
});
