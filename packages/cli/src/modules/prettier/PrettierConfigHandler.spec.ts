import { existsSync, writeFileSync } from 'fs';

import prompts from 'prompts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { PrettierConfigHandler } from './PrettierConfigHandler.ts';
import { EModulesPrettier } from './types.ts';

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(() => false),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

describe('PrettierConfigHandler', () => {
  const configHandler = new PrettierConfigHandler(dummyModulesConfig, {});

  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(writeFileSync).mockClear();
  });

  describe('getConfigFromModules', () => {
    it('should return the config for modules', () => {
      expect(configHandler.getConfigFromModules()).toStrictEqual({});
    });

    it('should serialize custom sources that differ from the source path', () => {
      const handler = new PrettierConfigHandler(
        { ...structuredClone(dummyModulesConfig), modules: { prettier: { sources: ['lib'] } } },
        {}
      );

      expect(handler.getConfigFromModules()).toStrictEqual({ prettier: { sources: ['lib'] } });
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
          prettier: {
            sources: [''],
          },
        },
        srcPath: '',
      });
    });
  });

  describe('getPrompts', () => {
    it('should default sources to the source path when no extra paths are requested', async () => {
      prompts.inject([EModulesPrettier.PRETTIER, false]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new PrettierConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(writeFileSync).toHaveBeenCalledWith(
        PrettierConfigHandler.CONFIG_FILE_PATH,
        `"${EModulesPrettier.PRETTIER}"`
      );
      expect(modulesConfig.modules.prettier).toStrictEqual({ sources: [''] });
    });

    it('should keep the requested extra paths as sources', async () => {
      prompts.inject([EModulesPrettier.PRETTIER_WITH_JSON_SORT, true, ['lib', 'docs']]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new PrettierConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(modulesConfig.modules.prettier).toStrictEqual({ sources: ['lib', 'docs'] });
    });
  });

  describe('minimal config from wizard defaults', () => {
    it('emits an empty config when the user keeps the default sources', async () => {
      prompts.inject([EModulesPrettier.PRETTIER, false]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new PrettierConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(handler.getConfigFromModules()).toStrictEqual({});
    });

    it('serializes only the sources when the user adds extra paths', async () => {
      prompts.inject([EModulesPrettier.PRETTIER, true, ['lib']]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new PrettierConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(handler.getConfigFromModules()).toStrictEqual({ prettier: { sources: ['lib'] } });
    });
  });

  describe('getPackages', () => {
    it('should default to the basic prettier package when no config file exists', () => {
      expect(configHandler.getPackages()).toStrictEqual([
        `@ladamczyk/${EModulesPrettier.PRETTIER}`,
      ]);
    });
  });
});
