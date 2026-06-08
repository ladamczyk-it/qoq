import { writeFileSync } from 'fs';

import { EExitCode, executeCommand } from '@ladamczyk/qoq-utils';
import { dummyModulesConfig } from '__tests__/common.ts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { IExecutorOptions } from '../types.ts';

import { StylelintExecutor } from './StylelintExecutor.ts';
import { EModulesStylelint, TModuleStylelintConfig } from './types.ts';

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  writeFileSync: vi.fn(),
}));

vi.mock('@ladamczyk/qoq-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ladamczyk/qoq-utils')>()),
  executeCommand: vi.fn(),
}));

const baseOptions: IExecutorOptions = {
  output: 'out',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

const configWith = (stylelint: TModuleStylelintConfig) => ({
  ...dummyModulesConfig,
  modules: { stylelint },
});

const getArgs = (): string[] => {
  const [[, args]] = vi.mocked(executeCommand).mock.calls;

  return args as string[];
};

describe('StylelintExecutor', () => {
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
    vi.mocked(writeFileSync).mockClear();
  });

  describe('getName', () => {
    it('should return the capitalized command name', () => {
      expect(new StylelintExecutor(dummyModulesConfig, true, true).getName()).toBe('Stylelint');
    });
  });

  describe('run', () => {
    it('should terminate gracefully (return OK) when there is no stylelint config', async () => {
      const executor = new StylelintExecutor(dummyModulesConfig, true, true);

      const result = await executor.run(baseOptions);

      expect(executeCommand).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });

    it('should use the configured pattern as the target', async () => {
      const executor = new StylelintExecutor(
        configWith({ strict: false, pattern: 'src/**/*.css' }),
        true,
        true
      );

      await executor.run(baseOptions);

      const args = getArgs();
      expect(args).toContain('"src/**/*.css"');
      expect(args).toContain('-c');
      expect(args).not.toContain('--max-warnings');
    });

    it('should derive the glob from a scss template and add strict warnings', async () => {
      const executor = new StylelintExecutor(
        configWith({ strict: true, template: EModulesStylelint.STYLELINT_SCSS }),
        true,
        true
      );

      await executor.run(baseOptions);

      const args = getArgs();
      expect(args).toContain('/**/*.{css,scss,sass}');
      expect(args).toContain('--max-warnings');
    });

    it('should add the json formatter when json is requested', async () => {
      const executor = new StylelintExecutor(
        configWith({ strict: false, template: EModulesStylelint.STYLELINT_CSS }),
        true,
        true
      );

      await executor.run({ ...baseOptions, json: 'true' });

      expect(getArgs().some((arg) => arg.includes('--formatter json'))).toBe(true);
    });

    it('should report and exit on an invalid config', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const executor = new StylelintExecutor(configWith({ strict: false }), true, true);

      await executor.run(baseOptions);

      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
    });
  });
});
