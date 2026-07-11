import { EExitCode } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { QoqConfig } from '../../helpers/types.ts';
import { IExecutorOptions } from '../types.ts';

import { BasicExecutor } from './BasicExecutor.ts';

const { baseConfig } = vi.hoisted(() => ({ baseConfig: { rules: {} } }));

vi.mock('@ladamczyk/qoq-eslint-v9-ts', () => ({ baseConfig }));

// In this monorepo every qoq-eslint-v9-* template is a real symlinked peer
// dependency, so importing one actually loads the full ESLint toolchain (slow and
// flaky under suite load). Mock this template to reject so the load-failure branch
// is exercised deterministically without touching the real package.
vi.mock('@ladamczyk/qoq-eslint-v9-js-react', () => {
  throw new Error('not installed');
});

const baseOptions: IExecutorOptions = {
  output: 'report-out',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

const writes: string[] = [];

const withRawConfig = (rawConfig: QoqConfig, silent = false) =>
  new BasicExecutor({ ...dummyModulesConfig, rawConfig }, silent, true);

describe('BasicExecutor', () => {
  beforeEach(() => {
    writes.length = 0;
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));

      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
    baseConfig.rules = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getName', () => {
    it('should return the capitalized command name', () => {
      expect(new BasicExecutor(dummyModulesConfig, true, true).getName()).toBe('Selfcheck');
    });
  });

  describe('run', () => {
    it('should be a no-op when there is no raw config', async () => {
      const result = await new BasicExecutor(dummyModulesConfig, true, true).run(baseOptions);

      expect(result).toBe(EExitCode.OK);
      expect(writes.join('')).not.toContain('redundant');
    });

    it('should not warn for a clean config', async () => {
      const executor = withRawConfig({ npm: { checkOutdatedEvery: 7 }, jscpd: { threshold: 5 } });

      const result = await executor.run(baseOptions);

      expect(result).toBe(EExitCode.OK);
      expect(writes.join('')).not.toContain('redundant');
    });

    it('should warn about entries that match a tool default', async () => {
      const executor = withRawConfig({
        npm: { checkOutdatedEvery: 1 },
        jscpd: { threshold: 2 },
      });

      await executor.run(baseOptions);
      const output = writes.join('');

      expect(output).toContain('found 2 redundant entries');
      expect(output).toContain('npm.checkOutdatedEvery = 1 — matches the tool default');
      expect(output).toContain('jscpd.threshold = 2 — matches the tool default');
    });

    it('should not warn about an optional tool activation key (skillslint.path)', async () => {
      const executor = withRawConfig({ skillslint: { path: './skills' } });

      const result = await executor.run(baseOptions);

      expect(result).toBe(EExitCode.OK);
      expect(writes.join('')).not.toContain('redundant');
    });

    it('should warn about eslint rules already set in the template base config', async () => {
      baseConfig.rules = { 'no-console': 'off' };
      const executor = withRawConfig({
        eslint: [{ template: 'qoq-eslint-v9-ts', rules: { 'no-console': 0 } }],
      });

      await executor.run(baseOptions);
      const output = writes.join('');

      expect(output).toContain('found 1 redundant entry');
      expect(output).toContain(
        'eslint[0].rules.no-console = 0 — already set in qoq-eslint-v9-ts base config'
      );
    });

    it('should ignore eslint templates that cannot be resolved', async () => {
      const executor = withRawConfig({
        eslint: [{ template: 'qoq-eslint-v9-js-react', rules: { 'no-console': 'off' } }],
      });

      const result = await executor.run(baseOptions);

      expect(result).toBe(EExitCode.OK);
      expect(writes.join('')).not.toContain('redundant');
    });

    it('should stay silent when silent mode is enabled', async () => {
      const executor = withRawConfig({ jscpd: { threshold: 2 } }, true);

      await executor.run(baseOptions);

      expect(writes.join('')).not.toContain('redundant');
    });
  });
});
