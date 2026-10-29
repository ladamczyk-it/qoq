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
  });
});
