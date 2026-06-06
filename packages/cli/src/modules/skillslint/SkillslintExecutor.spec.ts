import { EExitCode, executeCommand } from '@ladamczyk/qoq-utils';
import { dummyModulesConfig } from '__tests__/common.ts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { IExecutorOptions } from '../types.ts';

import { SkillslintExecutor } from './SkillslintExecutor.ts';

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
    vi.mocked(executeCommand).mockResolvedValue(EExitCode.OK as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(executeCommand).mockReset();
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

      expect(executeCommand).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });

    it('should pass the configured path to the command', async () => {
      const executor = new SkillslintExecutor(configWithSkillslint, true, true);

      await executor.run(baseOptions);

      expect(executeCommand).toHaveBeenCalledWith(
        'skillslint',
        ['--path', 'skills'],
        'inherit',
        false
      );
    });

    it('should append --fix when fixing is enabled', async () => {
      const executor = new SkillslintExecutor(configWithSkillslint, true, true);

      await executor.run({ ...baseOptions, fix: true });

      expect(executeCommand).toHaveBeenCalledWith(
        'skillslint',
        ['--path', 'skills', '--fix'],
        'inherit',
        false
      );
    });
  });
});
