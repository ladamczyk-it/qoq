import { writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

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

const passingResult = { root: 'src', passed: true, violations: [] };

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

    it('should lint the inline structure without consenting to stats on its own', async () => {
      const executor = new StructurelintExecutor(configWithStructurelint, true, true);

      const result = await executor.run(baseOptions);

      expect(lint).toHaveBeenCalledWith({
        config: { structureRoot: 'src', structure },
        stats: false,
      });
      expect(result).toBe(EExitCode.OK);
    });

    it("should pass the user's stats consent through to structurelint", async () => {
      const executor = new StructurelintExecutor(
        { ...configWithStructurelint, stats: true },
        true,
        true
      );

      await executor.run(baseOptions);

      expect(lint).toHaveBeenCalledWith(expect.objectContaining({ stats: true }));
    });

    it('should return ERROR when validation finds violations', async () => {
      lint.mockResolvedValue({
        root: 'src',
        passed: false,
        violations: [{ path: 'src/Foo.ts', type: 'unexpected', message: 'nope' }],
      });
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

      expect(lint).toHaveBeenCalledWith({ config: { structure }, stats: false });
    });

    it('should print the real error and exit with an exception when the configured root does not exist', async () => {
      lint.mockRejectedValue(new Error('Structure root "src" does not exist or is not a folder.'));
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const executor = new StructurelintExecutor(configWithStructurelint, true, true);

      await executor.run(baseOptions);

      expect(stderrMock).toHaveBeenCalledWith(
        expect.stringContaining('Structure root "src" does not exist or is not a folder.')
      );
      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
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
      expect(lint).not.toHaveBeenCalled();
    });
  });
});
