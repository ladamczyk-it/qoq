import { describe, it, expect } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { QoqConfig } from '../../helpers/types.ts';
import { IModulesConfig } from '../types.ts';

import { AbstractConfigHandler } from './AbstractConfigHandler.ts';

class StubHandler extends AbstractConfigHandler {
  constructor(modulesConfig: IModulesConfig, config: QoqConfig, packages: string[] = []) {
    super(modulesConfig, config);
    this.packages = packages;
  }

  getPrompts(): Promise<void> {
    return Promise.resolve();
  }
}

const makeModulesConfig = (srcPath: string): IModulesConfig => ({
  ...dummyModulesConfig,
  srcPath,
});

describe('AbstractConfigHandler', () => {
  describe('a single handler', () => {
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
  });

  // Handlers no longer delegate to a successor: the caller runs an ordered array
  // of them, and they all read and write the one shared pair of objects.
  describe('a sequence of handlers', () => {
    const modulesConfig = makeModulesConfig('shared');
    const config: QoqConfig = { srcPath: 'shared' };

    const handlers = [
      new StubHandler(modulesConfig, config, ['@pkg/a']),
      new StubHandler(modulesConfig, config, ['@pkg/b']),
    ];

    it('every handler should return the same shared objects', () => {
      handlers.forEach((handler) => {
        expect(handler.getConfigFromModules()).toBe(config);
        expect(handler.getModulesFromConfig()).toBe(modulesConfig);
      });
    });

    it('getPackages should aggregate across the sequence when flattened by the caller', () => {
      expect(handlers.flatMap((handler) => handler.getPackages())).toStrictEqual([
        '@pkg/a',
        '@pkg/b',
      ]);
    });
  });
});
