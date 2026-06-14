import { existsSync, writeFileSync } from 'fs';

import { dummyModulesConfig } from '__tests__/common.ts';
import prompts from 'prompts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { StylelintConfigHandler } from './StylelintConfigHandler.ts';
import { EModulesStylelint } from './types.ts';

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(() => false),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

describe('StylelintConfigHandler', () => {
  const configHandler = new StylelintConfigHandler(dummyModulesConfig, {});

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

    it('should serialize a template-based stylelint config', () => {
      const handler = new StylelintConfigHandler(
        {
          ...structuredClone(dummyModulesConfig),
          modules: { stylelint: { strict: true, template: EModulesStylelint.STYLELINT_CSS } },
        },
        {}
      );

      expect(handler.getConfigFromModules()).toStrictEqual({
        stylelint: { strict: true, template: EModulesStylelint.STYLELINT_CSS },
      });
    });

    it('should serialize a pattern-based stylelint config', () => {
      const handler = new StylelintConfigHandler(
        {
          ...structuredClone(dummyModulesConfig),
          modules: { stylelint: { strict: false, pattern: 'src/**/*.css' } },
        },
        {}
      );

      expect(handler.getConfigFromModules()).toStrictEqual({
        stylelint: { strict: false, pattern: 'src/**/*.css' },
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

    it('should read a template-based stylelint config', () => {
      const handler = new StylelintConfigHandler(structuredClone(dummyModulesConfig), {
        stylelint: { strict: true, template: EModulesStylelint.STYLELINT_SCSS },
      });

      expect(handler.getModulesFromConfig().modules.stylelint).toStrictEqual({
        strict: true,
        template: EModulesStylelint.STYLELINT_SCSS,
      });
    });
  });

  describe('getPrompts', () => {
    it('should not register a stylelint module when the user declines', async () => {
      prompts.inject([false]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new StylelintConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(modulesConfig.modules.stylelint).toBeUndefined();
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('should store the chosen template and strictness when the user opts in', async () => {
      prompts.inject([true, EModulesStylelint.STYLELINT_CSS, false]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new StylelintConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(writeFileSync).toHaveBeenCalled();
      expect(modulesConfig.modules.stylelint).toStrictEqual({
        strict: false,
        template: EModulesStylelint.STYLELINT_CSS,
      });
    });
  });

  describe('minimal config from wizard defaults', () => {
    it('emits an empty config when the user declines style linting', async () => {
      prompts.inject([false]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new StylelintConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(handler.getConfigFromModules()).toStrictEqual({});
    });

    it('serializes the chosen template when the user opts in', async () => {
      prompts.inject([true, EModulesStylelint.STYLELINT_CSS, false]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new StylelintConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(handler.getConfigFromModules()).toStrictEqual({
        stylelint: { strict: false, template: EModulesStylelint.STYLELINT_CSS },
      });
    });
  });

  describe('getPackages', () => {
    it('should expose the chosen stylelint template package', () => {
      const handler = new StylelintConfigHandler(
        {
          ...structuredClone(dummyModulesConfig),
          modules: { stylelint: { strict: false, template: EModulesStylelint.STYLELINT_SCSS } },
        },
        {}
      );

      expect(handler.getPackages()).toStrictEqual([
        `@ladamczyk/${EModulesStylelint.STYLELINT_SCSS}`,
      ]);
    });
  });
});
