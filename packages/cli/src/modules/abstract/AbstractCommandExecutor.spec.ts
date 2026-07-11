import { EExitCode, executeCommand } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { IExecutorOptions } from '../types.ts';

import { AbstractCommandExecutor } from './AbstractCommandExecutor.ts';

vi.mock('@ladamczyk/qoq-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ladamczyk/qoq-utils')>()),
  executeCommand: vi.fn(),
}));

class TestExecutor extends AbstractCommandExecutor {
  static readonly CACHE_PATH = '.qoq-test.cache';

  protected getCommandName(): string {
    return 'mytool';
  }

  protected getCommandArgs(): string[] {
    return ['--foo'];
  }
}

const baseOptions: IExecutorOptions = {
  output: '',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

describe('AbstractCommandExecutor', () => {
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
  });

  describe('getName', () => {
    it('should return the capitalized command name', () => {
      expect(new TestExecutor(dummyModulesConfig).getName()).toBe('Mytool');
    });
  });

  describe('run', () => {
    it('should delegate to executeCommand with the command args and return its exit code', async () => {
      const executor = new TestExecutor(dummyModulesConfig, true, true);

      const result = await executor.run(baseOptions);

      expect(executeCommand).toHaveBeenCalledWith('mytool', ['--foo'], 'inherit', false);
      expect(result).toBe(EExitCode.OK);
    });

    it('should append cache args when caching is enabled', async () => {
      const executor = new TestExecutor(dummyModulesConfig, true, true);

      await executor.run({ ...baseOptions, disableCache: false });

      expect(executeCommand).toHaveBeenCalledWith(
        'mytool',
        ['--foo', '--cache', '--cache-location', TestExecutor.CACHE_PATH],
        'inherit',
        false
      );
    });

    it('should short-circuit to OK during warmup without executing the command', async () => {
      const executor = new TestExecutor(dummyModulesConfig, true, true);

      const result = await executor.run({ ...baseOptions, warmup: true });

      expect(executeCommand).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });

    it('should write a running message when not silent', async () => {
      const writeMock = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const executor = new TestExecutor(dummyModulesConfig, false, true);

      await executor.run(baseOptions);

      expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('Running Mytool'));
    });

    it('should swallow a graceful termination and return OK', async () => {
      vi.mocked(executeCommand).mockRejectedValue(new TerminateExecutorGracefully());
      const executor = new TestExecutor(dummyModulesConfig, true, true);

      await expect(executor.run(baseOptions)).resolves.toBe(EExitCode.OK);
    });

    it('should report unknown errors and exit with the exception code', async () => {
      vi.mocked(executeCommand).mockRejectedValue(new Error('boom'));
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const executor = new TestExecutor(dummyModulesConfig, true, true);

      await executor.run(baseOptions);

      expect(stderrMock).toHaveBeenCalledWith('Unknown error!\n');
      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
    });

    it('should throw when caching is enabled but no cache path is defined', async () => {
      class NoCacheExecutor extends AbstractCommandExecutor {
        protected getCommandName(): string {
          return 'nocache';
        }

        protected getCommandArgs(): string[] {
          return [];
        }
      }

      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const executor = new NoCacheExecutor(dummyModulesConfig, true, true);

      await executor.run({ ...baseOptions, disableCache: false });

      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
    });
  });
});
