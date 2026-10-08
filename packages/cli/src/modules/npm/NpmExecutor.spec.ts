import { existsSync, statSync, writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
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

const { check, formatTable } = vi.hoisted(() => ({ check: vi.fn(), formatTable: vi.fn() }));

vi.mock('@ladamczyk/outdated', () => ({ check, formatTable }));

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
    check.mockResolvedValue({ schemaVersion: 1, packages: [] });
    formatTable.mockReturnValue('TABLE\n');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    check.mockReset();
    formatTable.mockReset();
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

      expect(check).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });

    it('should skip the check while the lock file is still fresh', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({ birthtime: new Date() } as never);
      const executor = new NpmExecutor(dummyModulesConfig, true, true);

      const result = await executor.run(baseOptions);

      expect(check).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });

    it('should honour checkOutdatedEvery when deciding the lock file is stale', async () => {
      // Five days old, against a seven-day schedule: still fresh, so no check.
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        birthtime: new Date(Date.now() - 5 * 86400000),
      } as never);
      const executor = new NpmExecutor(
        { ...dummyModulesConfig, modules: { npm: { checkOutdatedEvery: 7 } } },
        true,
        true
      );

      const result = await executor.run(baseOptions);

      expect(check).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });

    it('should run the check once the lock file is older than checkOutdatedEvery', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        birthtime: new Date(Date.now() - 8 * 86400000),
      } as never);
      const executor = new NpmExecutor(
        { ...dummyModulesConfig, modules: { npm: { checkOutdatedEvery: 7 } } },
        true,
        true
      );

      await executor.run(baseOptions);

      expect(check).toHaveBeenCalled();
    });

    it('should print the table of problems and write the lock file', async () => {
      const result = { schemaVersion: 1, packages: [{ name: 'pkg', flags: ['outdated'] }] };
      check.mockResolvedValue(result);
      const executor = new NpmExecutor(dummyModulesConfig, false, true);

      const code = await executor.run(baseOptions);

      expect(formatTable).toHaveBeenCalledWith(result, {
        onlyProblems: true,
        now: expect.any(Date),
      });
      expect(stdoutMock).toHaveBeenCalledWith('TABLE\n');
      expect(writeFileSync).toHaveBeenCalledWith(NpmExecutor.LOCK_PATH, '');
      expect(code).toBe(EExitCode.OK);
    });

    it('should write the result verbatim to npm-report.json when --json is set', async () => {
      const result = { schemaVersion: 1, packages: [{ name: 'pkg', flags: ['outdated'] }] };
      check.mockResolvedValue(result);
      const executor = new NpmExecutor(dummyModulesConfig, true, true);

      await executor.run({ ...baseOptions, json: 'true', output: '.qoq/reports' });

      expect(writeFileSync).toHaveBeenCalledWith(
        '.qoq/reports/npm-report.json',
        JSON.stringify(result)
      );
      expect(formatTable).not.toHaveBeenCalled();
    });

    it('should not write a report when --json is not set', async () => {
      vi.mocked(writeFileSync).mockClear();
      const executor = new NpmExecutor(dummyModulesConfig, true, true);

      await executor.run(baseOptions);

      expect(writeFileSync).not.toHaveBeenCalledWith(
        expect.stringContaining('npm-report.json'),
        expect.anything()
      );
    });

    it('should warn and stay OK when the check throws, leaving no lock file', async () => {
      const stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      check.mockRejectedValue(new Error('offline'));
      vi.mocked(writeFileSync).mockClear();
      const executor = new NpmExecutor(dummyModulesConfig, false, true);

      const code = await executor.run(baseOptions);

      expect(stderrMock).toHaveBeenCalledWith(expect.stringContaining('offline'));
      expect(writeFileSync).not.toHaveBeenCalled();
      expect(code).toBe(EExitCode.OK);
    });

    it('should print nothing when silenced, and still write the lock file', async () => {
      const executor = new NpmExecutor(dummyModulesConfig, true, true);

      await executor.run(baseOptions);

      expect(stdoutMock).not.toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalledWith(NpmExecutor.LOCK_PATH, '');
    });

    it('should ignore a fresh lock file when the tool was named explicitly', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({ birthtime: new Date() } as never);
      const executor = new NpmExecutor(dummyModulesConfig, true, true, true);

      await executor.run(baseOptions);

      expect(check).toHaveBeenCalled();
    });
  });
});
