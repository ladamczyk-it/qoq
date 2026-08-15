import { EExitCode, executeCommand } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { IExecutorOptions } from '../types.ts';

import { AbstractApiExecutor } from './AbstractApiExecutor.ts';

vi.mock('@ladamczyk/qoq-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ladamczyk/qoq-utils')>()),
  executeCommand: vi.fn(),
}));

class TestApiExecutor extends AbstractApiExecutor {
  // Exposes the inherited [] for assertion.
  publicCommandArgs(): string[] {
    return this.getCommandArgs();
  }

  protected getCommandName(): string {
    return 'apitool';
  }

  protected prepare(): Promise<void> {
    return Promise.resolve();
  }

  // Drives a "JS API" instead of spawning a binary.
  protected execute(): Promise<string | EExitCode> {
    return Promise.resolve(EExitCode.OK);
  }
}

const baseOptions: IExecutorOptions = {
  output: 'report-out',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

describe('AbstractApiExecutor', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(executeCommand).mockReset();
  });

  describe('getCommandArgs', () => {
    it('should default to no CLI args (the tool is driven via its JS API)', () => {
      expect(new TestApiExecutor(dummyModulesConfig, true, true).publicCommandArgs()).toStrictEqual(
        []
      );
    });
  });

  describe('run', () => {
    it('should run the subclass execute() without spawning a binary', async () => {
      const executor = new TestApiExecutor(dummyModulesConfig, true, true);

      const result = await executor.run(baseOptions);

      expect(executeCommand).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });
  });
});
