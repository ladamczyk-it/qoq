import { writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import { dummyModulesConfig } from '__tests__/common.ts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { IExecutorOptions } from '../types.ts';

import { StructurelintExecutor } from './StructurelintExecutor.ts';

const { lint, format } = vi.hoisted(() => ({
  lint: vi.fn(),
  format: vi.fn(() => ''),
}));

vi.mock('@ladamczyk/structurelint', () => ({ lint, format }));

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  writeFileSync: vi.fn(),
}));

const baseOptions: IExecutorOptions = {
  output: 'report-out',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

const passingResult = {
  root: 'src',
  violations: [],
  passed: true,
};

const configWithStructurelint = {
  ...dummyModulesConfig,
  modules: { structurelint: { path: 'src' } },
};

describe('StructurelintExecutor', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
    lint.mockResolvedValue(passingResult);
    format.mockReturnValue('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    lint.mockReset();
    format.mockReset();
    vi.mocked(writeFileSync).mockReset();
  });

  describe('getName', () => {
    it('should return the capitalized command name', () => {
      expect(new StructurelintExecutor(dummyModulesConfig, true, true).getName()).toBe(
        'Structurelint'
      );
    });
  });

  describe('run', () => {
    it('should terminate gracefully (return OK) when there is no structurelint config', async () => {
      const executor = new StructurelintExecutor(dummyModulesConfig, true, true);

      const result = await executor.run(baseOptions);

      expect(lint).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });

    it('should lint the configured path via the JS API', async () => {
      const executor = new StructurelintExecutor(configWithStructurelint, true, true);

      await executor.run(baseOptions);

      expect(lint).toHaveBeenCalledWith({ path: 'src' });
    });

    it('should return ERROR when the result does not pass', async () => {
      lint.mockResolvedValue({ ...passingResult, passed: false });
      const executor = new StructurelintExecutor(configWithStructurelint, true, true);

      const result = await executor.run(baseOptions);

      expect(result).toBe(EExitCode.ERROR);
    });

    it('should write a JSON report and skip console output when --json is set', async () => {
      const executor = new StructurelintExecutor(configWithStructurelint, true, true);

      await executor.run({ ...baseOptions, json: 'true' });

      expect(writeFileSync).toHaveBeenCalledWith(
        'report-out/structurelint-report.json',
        expect.any(String)
      );
      expect(format).not.toHaveBeenCalled();
    });
  });
});
