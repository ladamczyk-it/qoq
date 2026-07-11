import { statSync, writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { IExecutorOptions } from '../types.ts';

import { StructurelintExecutor } from './StructurelintExecutor.ts';

const { validate, format } = vi.hoisted(() => ({
  validate: vi.fn(),
  format: vi.fn(() => ''),
}));

vi.mock('@ladamczyk/structurelint', () => ({ validate, format }));

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const baseOptions: IExecutorOptions = {
  output: 'report-out',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

const structure = [{ name: 'src', children: [] }];

const configWithStructurelint = {
  ...dummyModulesConfig,
  modules: { structurelint: { structureRoot: 'src', structure } },
};

describe('StructurelintExecutor', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
    validate.mockReturnValue([]);
    format.mockReturnValue('');
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    validate.mockReset();
    format.mockReset();
    vi.mocked(writeFileSync).mockReset();
    vi.mocked(statSync).mockReset();
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

      expect(validate).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });

    it('should validate the configured structureRoot against the inline structure', async () => {
      const executor = new StructurelintExecutor(configWithStructurelint, true, true);

      const result = await executor.run(baseOptions);

      expect(validate).toHaveBeenCalledWith(expect.stringContaining('src'), {
        structureRoot: 'src',
        structure,
      });
      expect(result).toBe(EExitCode.OK);
    });

    it('should return ERROR when validation finds violations', async () => {
      validate.mockReturnValue([{ path: 'src/Foo.ts', type: 'unexpected', message: 'nope' }]);
      const executor = new StructurelintExecutor(configWithStructurelint, true, true);

      const result = await executor.run(baseOptions);

      expect(result).toBe(EExitCode.ERROR);
    });

    it('should write a JSON report and skip console output when --json is set', async () => {
      const executor = new StructurelintExecutor(configWithStructurelint, true, true);

      await executor.run({ ...baseOptions, json: 'true' });

      expect(writeFileSync).toHaveBeenCalledWith(
        'report-out/structurelint-report.json',
        expect.stringContaining('')
      );
      expect(format).not.toHaveBeenCalled();
    });

    it('should default the root to "." when no structureRoot is set', async () => {
      const executor = new StructurelintExecutor(
        { ...dummyModulesConfig, modules: { structurelint: { structure } } },
        true,
        true
      );

      await executor.run(baseOptions);

      expect(validate).toHaveBeenCalledWith(expect.stringMatching(/.*/), { structure });
    });

    it('should print the real error and exit with an exception when the configured root does not exist', async () => {
      vi.mocked(statSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const executor = new StructurelintExecutor(configWithStructurelint, true, true);

      await executor.run(baseOptions);

      expect(stderrMock).toHaveBeenCalledWith(
        expect.stringContaining('Structure root "src" does not exist or is not a folder.')
      );
      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
      expect(validate).not.toHaveBeenCalled();
    });

    it('should print the real error and exit with an exception when no structure is provided', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const executor = new StructurelintExecutor(
        { ...dummyModulesConfig, modules: { structurelint: { structureRoot: 'src' } } },
        true,
        true
      );

      await executor.run(baseOptions);

      expect(stderrMock).toHaveBeenCalledWith(
        expect.stringContaining('Structurelint is enabled but no `structure` was provided.')
      );
      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
      expect(validate).not.toHaveBeenCalled();
    });
  });
});
