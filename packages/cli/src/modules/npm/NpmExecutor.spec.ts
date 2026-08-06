import { existsSync, statSync, writeFileSync } from 'fs';

import { EExitCode, executeCommand } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { IExecutorOptions } from '../types.ts';

import { NpmExecutor } from './NpmExecutor.ts';

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

vi.mock('@ladamczyk/qoq-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ladamczyk/qoq-utils')>()),
  executeCommand: vi.fn(),
}));

const baseOptions: IExecutorOptions = {
  output: '',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

describe('NpmExecutor', () => {
  let stdoutMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutMock = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(executeCommand).mockResolvedValue('{}');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(executeCommand).mockReset();
  });

  describe('getName', () => {
    it('should return the upper-cased command name', () => {
      expect(new NpmExecutor(dummyModulesConfig, true, true).getName()).toBe('NPM');
    });
  });

  describe('run', () => {
    it('should short-circuit to OK during warmup', async () => {
      const executor = new NpmExecutor(dummyModulesConfig, true, true);

      const result = await executor.run({ ...baseOptions, warmup: true });

      expect(executeCommand).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });

    it('should skip the check while the lock file is still fresh', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({ birthtime: new Date() } as never);
      const executor = new NpmExecutor(dummyModulesConfig, true, true);

      const result = await executor.run(baseOptions);

      expect(executeCommand).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });

    it('should report a major update and write the lock file', async () => {
      vi.mocked(executeCommand).mockResolvedValue(
        JSON.stringify({ pkg: { current: '1.0.0', latest: '2.0.0' } })
      );
      const executor = new NpmExecutor(dummyModulesConfig, true, true);

      const result = await executor.run(baseOptions);

      expect(stdoutMock).toHaveBeenCalledWith(expect.stringContaining('MAJOR'));
      expect(stdoutMock).toHaveBeenCalledWith('pkg 1.0.0 -> 2.0.0\n');
      expect(writeFileSync).toHaveBeenCalledWith(NpmExecutor.LOCK_PATH, '');
      expect(result).toBe(EExitCode.OK);
    });

    it('should write a lean npm-report.json when --json is set', async () => {
      vi.mocked(executeCommand).mockResolvedValue(
        JSON.stringify({ pkg: { current: '1.0.0', latest: '2.0.0' } })
      );
      const executor = new NpmExecutor(dummyModulesConfig, true, true);

      await executor.run({ ...baseOptions, json: 'true', output: '.qoq/reports' });

      expect(writeFileSync).toHaveBeenCalledWith(
        '.qoq/reports/npm-report.json',
        JSON.stringify({
          major: [{ name: 'pkg', current: '1.0.0', latest: '2.0.0' }],
          minor: [],
          patch: [],
        })
      );
    });

    it('should not write a report when --json is not set', async () => {
      vi.mocked(executeCommand).mockResolvedValue(
        JSON.stringify({ pkg: { current: '1.0.0', latest: '2.0.0' } })
      );
      vi.mocked(writeFileSync).mockClear();
      const executor = new NpmExecutor(dummyModulesConfig, true, true);

      await executor.run(baseOptions);

      expect(writeFileSync).not.toHaveBeenCalledWith(
        expect.stringContaining('npm-report.json'),
        expect.anything()
      );
    });

    it('should report when all dependencies are up to date', async () => {
      vi.mocked(executeCommand).mockResolvedValue('{}');
      const executor = new NpmExecutor(dummyModulesConfig, true, true);

      await executor.run(baseOptions);

      expect(stdoutMock).toHaveBeenCalledWith(expect.stringContaining('latest version'));
    });
  });
});
