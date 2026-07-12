import { describe, it, expect } from 'vitest';

import { EModulesEslint } from './eslint/types.ts';
import { configUsesTs, configUsesReact, getFilesExtensions } from './helpers.ts';
import { IModulesConfig } from './types.ts';

describe('helpers', () => {
  describe('configUsesTs', () => {
    it('should return true if any eslint config uses TypeScript', () => {
      const modules: IModulesConfig['modules'] = {
        eslint: [{ template: EModulesEslint.ESLINT_V9_TS }],
      };
      expect(configUsesTs(modules)).toBe(true);
    });

    it('should return false if no eslint config uses TypeScript', () => {
      const modules: IModulesConfig['modules'] = {
        eslint: [{ template: EModulesEslint.ESLINT_V9_JS_REACT }],
      };
      expect(configUsesTs(modules)).toBe(false);
    });
  });

  describe('configUsesReact', () => {
    it('should return true if any eslint config uses React', () => {
      const modules: IModulesConfig['modules'] = {
        eslint: [{ template: EModulesEslint.ESLINT_V9_JS_REACT }],
      };
      expect(configUsesReact(modules)).toBe(true);
    });

    it('should return false if no eslint config uses React', () => {
      const modules: IModulesConfig['modules'] = {
        eslint: [{ template: EModulesEslint.ESLINT_V9_TS }],
      };
      expect(configUsesReact(modules)).toBe(false);
    });
  });

  describe('getFilesExtensions', () => {
    it('should return ["js", "jsx", "ts", "tsx"] if config uses both TypeScript and React', () => {
      const modules: IModulesConfig['modules'] = {
        eslint: [{ template: EModulesEslint.ESLINT_V9_TS_REACT }],
      };
      expect(getFilesExtensions(modules)).toStrictEqual(['js', 'jsx', 'ts', 'tsx']);
    });

    it('should return ["ts"] if config uses TypeScript but not React', () => {
      const modules: IModulesConfig['modules'] = {
        eslint: [{ template: EModulesEslint.ESLINT_V9_TS }],
      };
      expect(getFilesExtensions(modules)).toStrictEqual(['ts']);
    });

    it('should return ["js", "jsx"] if config uses React but not TypeScript', () => {
      const modules: IModulesConfig['modules'] = {
        eslint: [{ template: EModulesEslint.ESLINT_V9_JS_REACT }],
      };
      expect(getFilesExtensions(modules)).toStrictEqual(['js', 'jsx']);
    });

    it('should return ["js"] if config uses neither TypeScript nor React', () => {
      const modules: IModulesConfig['modules'] = {
        eslint: [{ template: EModulesEslint.ESLINT_V9_JS }],
      };
      expect(getFilesExtensions(modules)).toStrictEqual(['js']);
    });
  });
});
