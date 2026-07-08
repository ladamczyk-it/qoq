import { writeFileSync } from 'fs';

import { EExitCode, executeCommand } from '@ladamczyk/qoq-utils';
import { dummyModulesConfig } from '__tests__/common.ts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { IExecutorOptions } from '../types.ts';

import { AbstractApiExecutor } from './AbstractApiExecutor.ts';

vi.mock('@ladamczyk/qoq-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ladamczyk/qoq-utils')>()),
  executeCommand: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  writeFileSync: vi.fn(),
}));

class TestApiExecutor extends AbstractApiExecutor {
  // Exposes the inherited [] for assertion.
  publicCommandArgs(): string[] {
    return this.getCommandArgs();
  }

  protected getCommandName(): string {
    return 'apitool';
  }

  // Drives a "JS API" instead of spawning a binary, and uses the shared report
  // writer under --json.
  protected execute(_args: string[], options: IExecutorOptions): Promise<string | EExitCode> {
    if (options.json) {
      this.writeReport({ ok: true }, options.output);
    }

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
    vi.mocked(writeFileSync).mockReset();
  });

  describe('getCommandArgs', () => {
    it('should default to no CLI args (the tool is driven via its JS API)', () => {
      expect(new TestApiExecutor(dummyModulesConfig, true, true).publicCommandArgs()).toEqual([]);
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

  describe('writeReport', () => {
    it('should write the lean JSON report to <output>/<tool>-report.json', async () => {
      const executor = new TestApiExecutor(dummyModulesConfig, true, true);

      await executor.run({ ...baseOptions, json: 'true' });

      expect(writeFileSync).toHaveBeenCalledWith(
        'report-out/apitool-report.json',
        JSON.stringify({ ok: true })
      );
    });
  });
});
