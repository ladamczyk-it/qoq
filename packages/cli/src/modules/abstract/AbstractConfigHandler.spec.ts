import { dummyModulesConfig } from '__tests__/common.ts';
import { describe, it, expect } from 'vitest';

import { QoqConfig } from '../../helpers/types.ts';
import { IModulesConfig } from '../types.ts';

import { AbstractConfigHandler } from './AbstractConfigHandler.ts';

class StubHandler extends AbstractConfigHandler {
  constructor(modulesConfig: IModulesConfig, config: QoqConfig, packages: string[] = []) {
    super(modulesConfig, config);
    this.packages = packages;
  }
}

const makeModulesConfig = (srcPath: string): IModulesConfig => ({
  ...dummyModulesConfig,
  srcPath,
});

describe('AbstractConfigHandler', () => {
  describe('without a next handler', () => {
    const modulesConfig = makeModulesConfig('first');
    const config: QoqConfig = { srcPath: 'first' };
    const handler = new StubHandler(modulesConfig, config, ['@pkg/a']);

    it('getConfigFromModules should return its own config', () => {
      expect(handler.getConfigFromModules()).toBe(config);
    });

    it('getModulesFromConfig should return its own modules config', () => {
      expect(handler.getModulesFromConfig()).toBe(modulesConfig);
    });

    it('getPackages should return its own packages', () => {
      expect(handler.getPackages()).toStrictEqual(['@pkg/a']);
    });

    it('getPrompts should resolve', async () => {
      await expect(handler.getPrompts()).resolves.toBeUndefined();
    });
  });

  describe('with a chained handler', () => {
    const firstModules = makeModulesConfig('first');
    const lastModules = makeModulesConfig('last');
    const firstConfig: QoqConfig = { srcPath: 'first' };
    const lastConfig: QoqConfig = { srcPath: 'last' };

    const first = new StubHandler(firstModules, firstConfig, ['@pkg/a']);
    const last = new StubHandler(lastModules, lastConfig, ['@pkg/b']);
    const returned = first.setNext(last);

    it('setNext should return the passed handler', () => {
      expect(returned).toBe(last);
    });

    it('getConfigFromModules should delegate to the last handler', () => {
      expect(first.getConfigFromModules()).toBe(lastConfig);
    });

    it('getModulesFromConfig should delegate to the last handler', () => {
      expect(first.getModulesFromConfig()).toBe(lastModules);
    });

    it('getPackages should aggregate packages across the chain', () => {
      expect(first.getPackages()).toStrictEqual(['@pkg/a', '@pkg/b']);
    });
  });
});
