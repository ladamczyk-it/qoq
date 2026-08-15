import { existsSync, rmSync, writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { IExecutorOptions } from '../types.ts';

import { AbstractExecutor } from './AbstractExecutor.ts';

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Minimal test double: the template's five hooks and nothing else, so a failure
// here is a failure of run() itself rather than of any tool's own logic.
class TestExecutor extends AbstractExecutor<string> {
  static readonly CACHE_PATH = '.qoq-test.cache';

  executed: { args: string[]; context: string } | undefined;

  constructor(
    modulesConfig = dummyModulesConfig,
    private readonly onPrepare: () => string = () => 'context',
    silent = true,
    hideTimer = true
  ) {
    super(modulesConfig, silent, hideTimer);
  }

  report(output: string): void {
    this.writeReport({ ok: true }, output);
  }

  protected getCommandName(): string {
    return 'testtool';
  }

  protected getCommandArgs(): string[] {
    return ['--base'];
  }

  protected getCachePath(): string | undefined {
    return TestExecutor.CACHE_PATH;
  }

  protected prepare(args: string[]): Promise<string> {
    args.push('--from-prepare');

    return Promise.resolve(this.onPrepare());
  }

  protected execute(
    args: string[],
    _options: IExecutorOptions,
    context: string
  ): Promise<EExitCode> {
    this.executed = { args, context };

    return Promise.resolve(EExitCode.OK);
  }
}

const baseOptions: IExecutorOptions = {
  output: 'report-out',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

describe('AbstractExecutor', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(existsSync).mockReset();
    vi.mocked(rmSync).mockReset();
    vi.mocked(writeFileSync).mockReset();
  });

  describe('run', () => {
    it('should hand prepare()s return value and its args to execute()', async () => {
      const executor = new TestExecutor();

      const result = await executor.run(baseOptions);

      expect(result).toBe(EExitCode.OK);
      expect(executor.executed).toStrictEqual({
        args: ['--base', '--from-prepare'],
        context: 'context',
      });
    });

    it('should not share state between two runs of the same executor', async () => {
      const executor = new TestExecutor();

      await executor.run(baseOptions);
      await executor.run(baseOptions);

      // The second run starts from getCommandArgs() again — prepare()'s push does
      // not accumulate, which is what carrying the context through run() buys.
      expect(executor.executed?.args).toStrictEqual(['--base', '--from-prepare']);
    });

    it('should append cache args when caching is enabled', async () => {
      const executor = new TestExecutor();

      await executor.run({ ...baseOptions, disableCache: false });

      expect(executor.executed?.args).toStrictEqual([
        '--base',
        '--cache',
        '--cache-location',
        TestExecutor.CACHE_PATH,
        '--from-prepare',
      ]);
    });

    it('should skip cache args for an executor that declares no cache path', async () => {
      // getCachePath() returning undefined *is* the declaration that this tool
      // has no cache, so enabled caching simply does not apply to it.
      class NoCacheExecutor extends TestExecutor {
        protected getCachePath(): undefined {
          return undefined;
        }
      }

      const executor = new NoCacheExecutor();

      await executor.run({ ...baseOptions, disableCache: false });

      expect(executor.executed?.args).toStrictEqual(['--base', '--from-prepare']);
    });

    it('should clear an existing cache before prepare() during warmup', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const executor = new TestExecutor();

      const result = await executor.run({ ...baseOptions, disableCache: false, warmup: true });

      expect(rmSync).toHaveBeenCalledWith(TestExecutor.CACHE_PATH, {
        recursive: true,
        force: true,
      });
      // prepare() still ran (config regeneration is the point of warmup);
      // execute() did not.
      expect(executor.executed).toBeUndefined();
      expect(result).toBe(EExitCode.OK);
    });

    it('should turn a graceful termination thrown by prepare() into OK', async () => {
      const executor = new TestExecutor(dummyModulesConfig, () => {
        throw new TerminateExecutorGracefully();
      });

      const result = await executor.run(baseOptions);

      expect(result).toBe(EExitCode.OK);
      expect(executor.executed).toBeUndefined();
    });

    it('should report an unknown error and exit with the exception code', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const executor = new TestExecutor(dummyModulesConfig, () => {
        throw new Error('boom');
      });

      await executor.run(baseOptions);

      expect(stderrMock).toHaveBeenCalledWith('Unknown error!\n');
      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
    });

    it('should print the running message and the timer unless silenced', async () => {
      const writeMock = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const executor = new TestExecutor(dummyModulesConfig, () => 'context', false, false);

      await executor.run(baseOptions);

      expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('Running Testtool'));
      expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('execution time:'));
    });
  });

  describe('writeReport', () => {
    it('should write the report to <output>/<tool>-report.json', () => {
      new TestExecutor().report('report-out');

      expect(writeFileSync).toHaveBeenCalledWith(
        'report-out/testtool-report.json',
        JSON.stringify({ ok: true })
      );
    });
  });
});
