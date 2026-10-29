import prompts from 'prompts';
import { describe, it, expect } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { JustifyDisableConfigHandler } from './JustifyDisableConfigHandler.ts';

describe('JustifyDisableConfigHandler', () => {
  describe('getModulesFromConfig', () => {
    it('should read the justifyDisable config when present', () => {
      const handler = new JustifyDisableConfigHandler(structuredClone(dummyModulesConfig), {
        justifyDisable: { severity: 'warn' },
      });

      expect(handler.getModulesFromConfig().modules.justifyDisable).toStrictEqual({
        severity: 'warn',
      });
    });

    it('should leave modules.justifyDisable undefined without a justifyDisable config', () => {
      const handler = new JustifyDisableConfigHandler(structuredClone(dummyModulesConfig), {});

      expect(handler.getModulesFromConfig().modules.justifyDisable).toBeUndefined();
    });

    it('should copy a config of severity error onto modules.justifyDisable', () => {
      const handler = new JustifyDisableConfigHandler(structuredClone(dummyModulesConfig), {
        justifyDisable: { severity: 'error' },
      });

      expect(handler.getModulesFromConfig().modules.justifyDisable).toStrictEqual({
        severity: 'error',
      });
    });
  });

  describe('getConfigFromModules', () => {
    it('should serialize the justifyDisable config set on modules', () => {
      const modulesConfig = structuredClone(dummyModulesConfig);

      modulesConfig.modules.justifyDisable = { severity: 'error' };

      const handler = new JustifyDisableConfigHandler(modulesConfig, {});

      expect(handler.getConfigFromModules().justifyDisable).toStrictEqual({ severity: 'error' });
    });

    it('should leave no justifyDisable key without modules.justifyDisable', () => {
      const handler = new JustifyDisableConfigHandler(structuredClone(dummyModulesConfig), {});

      expect(handler.getConfigFromModules()).not.toHaveProperty('justifyDisable');
    });

    it('should serialize a warn severity set on modules into config.justifyDisable', () => {
      const modulesConfig = structuredClone(dummyModulesConfig);

      modulesConfig.modules.justifyDisable = { severity: 'warn' };

      const handler = new JustifyDisableConfigHandler(modulesConfig, {});

      expect(handler.getConfigFromModules().justifyDisable).toStrictEqual({ severity: 'warn' });
    });
  });

  describe('getPrompts', () => {
    it('should set modules.justifyDisable to warn severity when the user answers warn', async () => {
      prompts.inject(['warn']);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new JustifyDisableConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(modulesConfig.modules.justifyDisable).toStrictEqual({ severity: 'warn' });
    });

    it('should set modules.justifyDisable to error severity when the user answers error', async () => {
      prompts.inject(['error']);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new JustifyDisableConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(modulesConfig.modules.justifyDisable).toStrictEqual({ severity: 'error' });
    });

    it('should leave modules.justifyDisable undefined when the user answers off', async () => {
      prompts.inject(['off']);
      const modulesConfig = structuredClone(dummyModulesConfig);
      const handler = new JustifyDisableConfigHandler(modulesConfig, {});

      await handler.getPrompts();

      expect(modulesConfig.modules.justifyDisable).toBeUndefined();
    });
  });

  describe('getPackages', () => {
    it('should not include the justify-disable package when the user answers off', async () => {
      prompts.inject(['off']);
      const handler = new JustifyDisableConfigHandler(structuredClone(dummyModulesConfig), {});

      await handler.getPrompts();

      expect(handler.getPackages()).not.toContain('@ladamczyk/justify-disable');
    });

    it('should include the justify-disable package after a warn answer', async () => {
      prompts.inject(['warn']);
      const handler = new JustifyDisableConfigHandler(structuredClone(dummyModulesConfig), {});

      await handler.getPrompts();

      expect(handler.getPackages()).toContain('@ladamczyk/justify-disable');
    });
  });
});
