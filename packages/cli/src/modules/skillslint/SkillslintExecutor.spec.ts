import { writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import { dummyModulesConfig } from '__tests__/common.ts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { IExecutorOptions } from '../types.ts';

import { SkillslintExecutor } from './SkillslintExecutor.ts';

const { lint, format } = vi.hoisted(() => ({
  lint: vi.fn(),
  format: vi.fn(() => Promise.resolve('')),
}));

vi.mock('@ladamczyk/skillslint', () => ({ lint, format }));

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
  textlint: [],
  fixed: false,
  skills: [{ name: 'demo', scores: { overall: 90 }, passed: true }],
  passed: true,
};

const configWithSkillslint = {
  ...dummyModulesConfig,
  modules: { skillslint: { path: 'skills' } },
};

describe('SkillslintExecutor', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
    lint.mockResolvedValue(passingResult);
    format.mockResolvedValue('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    lint.mockReset();
    format.mockReset();
    vi.mocked(writeFileSync).mockReset();
  });

  describe('getName', () => {
    it('should return the capitalized command name', () => {
      expect(new SkillslintExecutor(dummyModulesConfig, true, true).getName()).toBe('Skillslint');
    });
  });

  describe('run', () => {
    it('should terminate gracefully (return OK) when there is no skillslint config', async () => {
      const executor = new SkillslintExecutor(dummyModulesConfig, true, true);

      const result = await executor.run(baseOptions);

      expect(lint).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });

    it('should lint the configured path via the JS API', async () => {
      const executor = new SkillslintExecutor(configWithSkillslint, true, true);

      await executor.run(baseOptions);

      expect(lint).toHaveBeenCalledWith({ path: 'skills', fix: false });
    });

    it('should request a fix when fixing is enabled', async () => {
      const executor = new SkillslintExecutor(configWithSkillslint, true, true);

      await executor.run({ ...baseOptions, fix: true });

      expect(lint).toHaveBeenCalledWith({ path: 'skills', fix: true });
    });

    it('should return ERROR when the result does not pass', async () => {
      lint.mockResolvedValue({ ...passingResult, passed: false });
      const executor = new SkillslintExecutor(configWithSkillslint, true, true);

      const result = await executor.run(baseOptions);

      expect(result).toBe(EExitCode.ERROR);
    });

    it('should write a JSON report and skip console output when --json is set', async () => {
      const executor = new SkillslintExecutor(configWithSkillslint, true, true);

      await executor.run({ ...baseOptions, json: 'true' });

      expect(writeFileSync).toHaveBeenCalledWith(
        'report-out/skillslint-report.json',
        expect.any(String)
      );
    });
  });
});
