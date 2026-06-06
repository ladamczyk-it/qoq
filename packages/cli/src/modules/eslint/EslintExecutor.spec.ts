import { writeFileSync } from 'fs';

import { EExitCode, executeCommand } from '@ladamczyk/qoq-utils';
import { dummyModulesConfig } from '__tests__/common.ts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { IExecutorOptions } from '../types.ts';

import { EslintExecutor } from './EslintExecutor.ts';

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  writeFileSync: vi.fn(),
}));

vi.mock('@ladamczyk/qoq-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ladamczyk/qoq-utils')>()),
  executeCommand: vi.fn(),
}));

const baseOptions: IExecutorOptions = {
  output: 'out',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

const configWithEslint = {
  ...dummyModulesConfig,
  modules: { eslint: [] },
};

const getArgs = (): string[] => {
  const [[, args]] = vi.mocked(executeCommand).mock.calls;

  return args as string[];
};

describe('EslintExecutor', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
    vi.mocked(executeCommand).mockResolvedValue(EExitCode.OK as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(executeCommand).mockReset();
    vi.mocked(writeFileSync).mockClear();
  });

  describe('getName', () => {
    it('should return the capitalized command name', () => {
      expect(new EslintExecutor(dummyModulesConfig, true, true).getName()).toBe('Eslint');
    });
  });

  describe('run', () => {
    it('should write the generated config and start from the base args', async () => {
      const executor = new EslintExecutor(configWithEslint, true, true);

      await executor.run(baseOptions);

      expect(writeFileSync).toHaveBeenCalled();
      const args = getArgs();
      expect(args).toContain('--max-warnings');
      expect(args).toContain('-c');
    });

    it('should append --fix when fixing is enabled', async () => {
      const executor = new EslintExecutor(configWithEslint, true, true);

      await executor.run({ ...baseOptions, fix: true });

      expect(getArgs()).toContain('--fix');
    });

    it('should append concurrency and json args when requested', async () => {
      const executor = new EslintExecutor(configWithEslint, true, true);

      await executor.run({ ...baseOptions, concurrency: 'auto', json: 'true' });

      const args = getArgs();
      expect(args).toContain('--concurrency auto');
      expect(args).toContain('--format json --output-file "out/eslint-report.json"');
    });

    it('should report and exit when config writing throws', async () => {
      vi.mocked(writeFileSync).mockImplementationOnce(() => {
        throw new Error('boom');
      });
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const executor = new EslintExecutor(configWithEslint, true, true);

      await executor.run(baseOptions);

      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
    });
  });
});
