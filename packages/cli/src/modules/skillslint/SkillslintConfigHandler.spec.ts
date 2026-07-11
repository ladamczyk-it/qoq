import prompts from 'prompts';
import { describe, it, expect } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { SkillslintConfigHandler } from './SkillslintConfigHandler.ts';

describe('SkillslintConfigHandler', () => {
  const configHandler = new SkillslintConfigHandler(dummyModulesConfig, {});

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

    it('should read the skillslint path from config when present', () => {
      const handler = new SkillslintConfigHandler(structuredClone(dummyModulesConfig), {
        skillslint: { path: 'docs/skills' },
      });

      expect(handler.getModulesFromConfig().modules.skillslint).toStrictEqual({
        path: 'docs/skills',
      });
    });
  });

  describe('getPrompts', () => {
    it('should not register a skillslint module when the user declines', async () => {
      prompts.inject([false]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new SkillslintConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(modulesConfig.modules.skillslint).toBeUndefined();
    });

    it('should store the provided path when the user opts in', async () => {
      prompts.inject([true, 'my/skills']);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new SkillslintConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(modulesConfig.modules.skillslint).toStrictEqual({ path: 'my/skills' });
    });
  });

  describe('minimal config from wizard defaults', () => {
    it('emits an empty config when the user declines skill linting', async () => {
      prompts.inject([false]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new SkillslintConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(handler.getConfigFromModules()).toStrictEqual({});
    });

    it('serializes the skills path when the user opts in', async () => {
      prompts.inject([true, SkillslintConfigHandler.DEFAULT_SKILLS_PATH]);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new SkillslintConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      // desired: opting in must persist to qoq.config.js
      // currently RED — SkillslintConfigHandler has no getConfigFromModules override
      expect(handler.getConfigFromModules()).toStrictEqual({
        skillslint: { path: SkillslintConfigHandler.DEFAULT_SKILLS_PATH },
      });
    });
  });

  describe('getPackages', () => {
    it('should expose the skillslint package', () => {
      expect(configHandler.getPackages()).toStrictEqual(['@ladamczyk/skillslint']);
    });
  });
});
