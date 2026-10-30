import { rmSync, writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { IExecutorOptions } from '../types.ts';

import { JustifyDisableExecutor } from './JustifyDisableExecutor.ts';

import type { TFileProvider } from '@ladamczyk/justify-disable';

const { lint, format, gitProvider } = vi.hoisted(() => ({
  lint: vi.fn(),
  format: vi.fn(() => ''),
  gitProvider: vi.fn(),
}));

vi.mock('@ladamczyk/justify-disable', () => ({
  lint,
  format,
  gitProvider,
  DEFAULT_EXTENSIONS: {},
}));

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

const passingResult = { passed: true, scanned: 0, violations: [] };

const baseOptions: IExecutorOptions = {
  output: 'report-out',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

const withSeverity = (severity: unknown, extra = {}) => ({
  ...dummyModulesConfig,
  ...extra,
  modules: { justifyDisable: { severity } },
});

const build = (config: object) =>
  new JustifyDisableExecutor(config as typeof dummyModulesConfig, true, true);

describe('JustifyDisableExecutor', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
    lint.mockResolvedValue(passingResult);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    lint.mockReset();
    format.mockReset();
    gitProvider.mockReset();
    vi.mocked(writeFileSync).mockReset();
    vi.mocked(rmSync).mockReset();
  });

  it('should return the capitalized command name', () => {
    expect(build(dummyModulesConfig).getName()).toBe('Justify-disable');
  });

  describe('run', () => {
    it('should terminate gracefully when there is no justifyDisable block', async () => {
      const result = await build(dummyModulesConfig).run(baseOptions);

      expect(result).toBe(EExitCode.OK);
      expect(lint).not.toHaveBeenCalled();
    });

    it('should terminate gracefully when severity is absent', async () => {
      const result = await build({ ...dummyModulesConfig, modules: { justifyDisable: {} } }).run(
        baseOptions
      );

      expect(result).toBe(EExitCode.OK);
      expect(lint).not.toHaveBeenCalled();
    });

    it('should remove the stale report when severity is off and --json is set', async () => {
      await build(withSeverity('off')).run({ ...baseOptions, json: 'true' });

      expect(rmSync).toHaveBeenCalledWith('report-out/justify-disable-report.json', {
        force: true,
      });
      expect(lint).not.toHaveBeenCalled();
    });

    it('should reject an unknown severity naming the config key', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      await build(withSeverity('warning')).run(baseOptions);

      expect(stderrMock).toHaveBeenCalledWith(expect.stringContaining('justifyDisable.severity'));
      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
      expect(lint).not.toHaveBeenCalled();
    });

    it('should lint with the severity applied to every reason rule', async () => {
      await build(withSeverity('error', { stats: true })).run(baseOptions);

      expect(lint).toHaveBeenCalledWith({
        config: {
          provider: expect.any(Function),
          rules: {
            missingReason: 'error',
            expired: 'error',
            invalidCondition: 'error',
            missingDate: 'off',
          },
        },
        paths: [],
        stats: true,
      });
    });

    it('should lint with stats false when stats is not enabled', async () => {
      await build(withSeverity('error')).run(baseOptions);

      expect(lint.mock.calls[0]?.[0].stats).toBe(false);
    });

    it('should pass warn through to the rules', async () => {
      await build(withSeverity('warn')).run(baseOptions);

      expect(lint.mock.calls[0]?.[0].config.rules).toStrictEqual({
        missingReason: 'warn',
        expired: 'warn',
        invalidCondition: 'warn',
        missingDate: 'off',
      });
    });

    it('should lint only the staged files', async () => {
      await build(withSeverity('error')).run(baseOptions, ['src/a.ts']);

      expect(lint).toHaveBeenCalledWith(expect.objectContaining({ paths: ['src/a.ts'] }));
    });

    it('should return ERROR when lint does not pass and OK when it does', async () => {
      lint.mockResolvedValue({ ...passingResult, passed: false });
      const failed = await build(withSeverity('error')).run(baseOptions);
      lint.mockResolvedValue(passingResult);
      const passed = await build(withSeverity('error')).run(baseOptions);

      expect(failed).toBe(EExitCode.ERROR);
      expect(passed).toBe(EExitCode.OK);
    });

    it('should write a JSON report and skip format when --json is set', async () => {
      await build(withSeverity('error')).run({ ...baseOptions, json: 'true' });

      expect(writeFileSync).toHaveBeenCalledWith(
        'report-out/justify-disable-report.json',
        JSON.stringify(passingResult)
      );
      expect(format).not.toHaveBeenCalled();
    });

    it('should print the formatted result without --json', async () => {
      format.mockReturnValue('formatted\n');
      const stdoutMock = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await build(withSeverity('error')).run(baseOptions);

      expect(stdoutMock).toHaveBeenCalledWith('formatted\n');
    });

    it('should warn and return OK when git is unavailable', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      gitProvider.mockRejectedValue(new Error('not a git repository'));
      lint.mockImplementation(({ config }: { config: { provider: TFileProvider } }) =>
        config.provider({ paths: [] })
      );

      const result = await build(withSeverity('error')).run(baseOptions);

      expect(result).toBe(EExitCode.OK);
      expect(exitMock).not.toHaveBeenCalled();
      expect(stderrMock).toHaveBeenCalledTimes(1);
      expect(stderrMock).toHaveBeenCalledWith(expect.stringContaining('git'));
    });

    it('should print the error and exit with an exception when lint rejects otherwise', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      lint.mockRejectedValue(new Error('boom'));

      await build(withSeverity('error')).run(baseOptions);

      expect(stderrMock).toHaveBeenCalledWith(expect.stringContaining('boom'));
      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
    });

    it('should not lint on warmup', async () => {
      await build(withSeverity('error')).run({ ...baseOptions, warmup: true });

      expect(lint).not.toHaveBeenCalled();
    });
  });
});
