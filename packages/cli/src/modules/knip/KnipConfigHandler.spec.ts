import { dummyModulesConfig } from '__tests__/common.ts';
import prompts from 'prompts';
import { describe, it, expect } from 'vitest';

import { KnipConfigHandler } from './KnipConfigHandler.ts';

describe('KnipConfigHandler', () => {
  const configHandler = new KnipConfigHandler(dummyModulesConfig, {});

  describe('getConfigFromModules', () => {
    it('should return the config for modules', () => {
      expect(configHandler.getConfigFromModules()).toStrictEqual({});
    });

    it('should serialize values that differ from the defaults', () => {
      const handler = new KnipConfigHandler(
        {
          ...structuredClone(dummyModulesConfig),
          modules: {
            knip: {
              entry: ['custom.ts'],
              project: ['lib/**'],
              ignore: ['dist'],
              ignoreDependencies: ['@x/*'],
              ignoreBinaries: ['foo'],
            },
          },
        },
        {}
      );

      expect(handler.getConfigFromModules()).toStrictEqual({
        knip: {
          entry: ['custom.ts'],
          project: ['lib/**'],
          ignore: ['dist'],
          ignoreDependencies: ['@x/*'],
          ignoreBinaries: ['foo'],
        },
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
          knip: {
            entry: ['/{index,cli,main,root}.{js}'],
            ignore: [
              'skills/**',
              'qoq.config.{js,ts}',
              'eslint.config.{js,ts}',
              'release.config.{js,ts}',
              'stylelint.config.{js,ts}',
              'vitest.config.{js,ts}',
            ],
            ignoreDependencies: ['@ladamczyk/*'],
            ignoreBinaries: [],
            project: ['/**/*.{js}'],
          },
        },
        srcPath: '',
      });
    });

    it('should merge configured ignores onto the defaults', () => {
      const handler = new KnipConfigHandler(structuredClone(dummyModulesConfig), {
        knip: { ignoreDependencies: ['@x/*'] },
      });

      expect(handler.getModulesFromConfig().modules.knip?.ignoreDependencies).toStrictEqual([
        '@ladamczyk/*',
        '@x/*',
      ]);
    });
  });

  describe('getPrompts', () => {
    it('should store the answered knip configuration', async () => {
      prompts.inject([['index.ts'], ['src/**'], ['dist'], ['@foo/*'], ['eslint']]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new KnipConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(modulesConfig.modules.knip).toStrictEqual({
        entry: ['index.ts'],
        project: ['src/**'],
        ignore: ['dist'],
        ignoreDependencies: ['@foo/*'],
        ignoreBinaries: ['eslint'],
      });
    });
  });

  describe('minimal config from wizard defaults', () => {
    // defaults derived from an empty project (see getModulesFromConfig spec above)
    const defaultEntry = ['/{index,cli,main,root}.{js}'];
    const defaultProject = ['/**/*.{js}'];

    it('emits an empty config when the user accepts every default', async () => {
      prompts.inject([defaultEntry, defaultProject, [], [], []]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new KnipConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(handler.getConfigFromModules()).toStrictEqual({});
    });

    it('serializes only the entry when the user changes it', async () => {
      prompts.inject([['custom.ts'], defaultProject, [], [], []]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new KnipConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(handler.getConfigFromModules()).toStrictEqual({ knip: { entry: ['custom.ts'] } });
    });
  });

  describe('getPackages', () => {
    it('should expose the knip package', () => {
      expect(configHandler.getPackages()).toStrictEqual(['@ladamczyk/qoq-knip']);
    });
  });
});
