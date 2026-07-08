import { EExitCode } from '@ladamczyk/qoq-utils';
import { dummyModulesConfig } from '__tests__/common.ts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { IExecutorOptions } from '../types.ts';

import { AbstractApiWithProgressExecutor } from './AbstractApiWithProgressExecutor.ts';

class TestProgressExecutor extends AbstractApiWithProgressExecutor {
  publicShowProgress(options: IExecutorOptions): boolean {
    return this.showProgress(options);
  }

  publicPrintProgress(file: string): void {
    this.printProgress(file);
  }

  publicClearProgress(): void {
    this.clearProgress();
  }

  publicFinishProgress(success: boolean): void {
    this.finishProgress(success);
  }

  protected getCommandName(): string {
    return 'apitool';
  }

  protected execute(): Promise<string | EExitCode> {
    return Promise.resolve(EExitCode.OK);
  }
}

const baseOptions: IExecutorOptions = {
  output: 'out',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

const originalIsTty = process.stdout.isTTY;

const setTty = (isTty: boolean): void => {
  Object.defineProperty(process.stdout, 'isTTY', { value: isTty, configurable: true });
};

describe('AbstractApiWithProgressExecutor', () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setTty(originalIsTty);
  });

  describe('showProgress', () => {
    it('should be true when neither silent nor json', () => {
      const executor = new TestProgressExecutor(dummyModulesConfig, false);

      expect(executor.publicShowProgress(baseOptions)).toBe(true);
    });

    it('should be false when the executor is silent (covers --silent/--warmup)', () => {
      const executor = new TestProgressExecutor(dummyModulesConfig, true);

      expect(executor.publicShowProgress(baseOptions)).toBe(false);
    });

    it('should be false under --json, so progress never mixes into machine-readable output', () => {
      const executor = new TestProgressExecutor(dummyModulesConfig, false);

      expect(executor.publicShowProgress({ ...baseOptions, json: 'true' })).toBe(false);
    });
  });

  describe('printProgress', () => {
    it('should print a plain, newline-terminated line off a TTY', () => {
      setTty(false);
      const executor = new TestProgressExecutor(dummyModulesConfig, false);

      executor.publicPrintProgress('src/a.js');

      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('src/a.js\n'));
    });

    it('should overwrite the current line in place on a TTY', () => {
      setTty(true);
      const executor = new TestProgressExecutor(dummyModulesConfig, false);

      executor.publicPrintProgress('src/a.js');

      const [text] = stdoutWrite.mock.calls[0] as [string];
      expect(text.startsWith('\r\x1b[K')).toBe(true);
      expect(text.endsWith('\n')).toBe(false);
    });
  });

  describe('clearProgress', () => {
    it('should clear the line on a TTY', () => {
      setTty(true);
      const executor = new TestProgressExecutor(dummyModulesConfig, false);

      executor.publicClearProgress();

      expect(stdoutWrite).toHaveBeenCalledWith('\r\x1b[K');
    });

    it('should write nothing off a TTY', () => {
      setTty(false);
      const executor = new TestProgressExecutor(dummyModulesConfig, false);

      executor.publicClearProgress();

      expect(stdoutWrite).not.toHaveBeenCalled();
    });
  });

  describe('finishProgress', () => {
    it('should print a generic done line on success', () => {
      setTty(false);
      const executor = new TestProgressExecutor(dummyModulesConfig, false);

      executor.publicFinishProgress(true);

      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('Apitool done.\n'));
    });

    it('should print nothing beyond clearing the line on failure', () => {
      setTty(false);
      const executor = new TestProgressExecutor(dummyModulesConfig, false);

      executor.publicFinishProgress(false);

      expect(stdoutWrite).not.toHaveBeenCalled();
    });
  });
});
