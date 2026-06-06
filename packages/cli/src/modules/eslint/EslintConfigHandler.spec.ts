import { existsSync, writeFileSync } from 'fs';

import { dummyModulesConfig } from '__tests__/common.ts';
import prompts from 'prompts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { EslintConfigHandler } from './EslintConfigHandler.ts';
import { EModulesEslint } from './types.ts';

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(() => false),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

describe('EslintConfigHandler', () => {
  const configHandler = new EslintConfigHandler(dummyModulesConfig, {});

  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(writeFileSync).mockClear();
  });

  describe('getConfigFromModules', () => {
    it('should return the config for modules', () => {
      expect(configHandler.getConfigFromModules()).toStrictEqual({
        eslint: undefined,
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
          eslint: undefined,
        },
        srcPath: '',
      });
    });

    it('should read the eslint configs from config', () => {
      const eslint = [{ template: EModulesEslint.ESLINT_V9_TS, files: ['src'], ignores: [] }];
      const handler = new EslintConfigHandler(structuredClone(dummyModulesConfig), { eslint });

      expect(handler.getModulesFromConfig().modules.eslint).toStrictEqual(eslint);
    });
  });

  describe('getPrompts', () => {
    it('should collect a typescript template with its files and ignores', async () => {
      prompts.inject([true, [EModulesEslint.ESLINT_V9_TS], ['src/**/*.ts'], ['**/*.spec.ts']]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new EslintConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(writeFileSync).toHaveBeenCalled();
      expect(modulesConfig.modules.eslint).toStrictEqual([
        {
          template: EModulesEslint.ESLINT_V9_TS,
          files: ['src/**/*.ts'],
          ignores: ['**/*.spec.ts'],
        },
      ]);
    });
  });

  describe('getPackages', () => {
    it('should default to the base js package when nothing is configured', () => {
      const handler = new EslintConfigHandler(structuredClone(dummyModulesConfig), {});

      expect(handler.getPackages()).toStrictEqual([EModulesEslint.ESLINT_V9_JS]);
    });

    it('should expose configured non-base templates', () => {
      const handler = new EslintConfigHandler(
        {
          ...structuredClone(dummyModulesConfig),
          modules: {
            eslint: [{ template: EModulesEslint.ESLINT_V9_TS_REACT, files: [], ignores: [] }],
          },
        },
        {}
      );

      expect(handler.getPackages()).toStrictEqual([EModulesEslint.ESLINT_V9_TS_REACT]);
    });
  });
});
