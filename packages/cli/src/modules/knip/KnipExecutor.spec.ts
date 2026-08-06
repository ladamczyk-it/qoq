import { writeFileSync } from 'fs';

import { getKnipConfig } from '@ladamczyk/qoq-knip';
import { EExitCode, executeCommand } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { IExecutorOptions } from '../types.ts';

import { KnipExecutor } from './KnipExecutor.ts';

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  writeFileSync: vi.fn(),
}));

vi.mock('@ladamczyk/qoq-knip', () => ({
  getKnipConfig: vi.fn(() => ({ entry: ['index.ts'], project: ['src/**'] })),
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

const configWithKnip = {
  ...dummyModulesConfig,
  modules: {
    knip: {
      entry: ['index.ts'],
      project: ['src/**'],
      ignore: [],
      ignoreDependencies: [],
      ignoreBinaries: [],
      ignoreFiles: [],
      ignoreMembers: [],
      ignoreUnresolved: [],
    },
  },
};

const getArgs = (): string[] => {
  const [firstCall] = vi.mocked(executeCommand).mock.calls;
  const [, args] = firstCall ?? [];

  return args as string[];
};

describe('KnipExecutor', () => {
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
      expect(new KnipExecutor(configWithKnip, true, true).getName()).toBe('Knip');
    });
  });

  describe('run', () => {
    it('should write the generated config and pass it via -c with config hints disabled', async () => {
      const executor = new KnipExecutor(configWithKnip, true, true);

      await executor.run(baseOptions);

      expect(getKnipConfig).toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalled();
      const args = getArgs();
      expect(args).toContain('-c');
      expect(args).toContain('--no-config-hints');
    });

    it('should keep config hints when requested', async () => {
      const executor = new KnipExecutor(configWithKnip, true, true);

      await executor.run({ ...baseOptions, configHints: true });

      expect(getArgs()).not.toContain('--no-config-hints');
    });

    it('should append --production, --fix and the json reporter when requested', async () => {
      const executor = new KnipExecutor(configWithKnip, true, true);

      await executor.run({ ...baseOptions, production: true, fix: true, json: 'true' });

      const args = getArgs();
      expect(args).toContain('--production');
      expect(args).toContain('--fix');
      expect(args).toContain('--reporter json > "out/knip-report.json"');
    });

    it('should report and exit when config generation throws', async () => {
      vi.mocked(getKnipConfig).mockImplementationOnce(() => {
        throw new Error('boom');
      });
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const executor = new KnipExecutor(configWithKnip, true, true);

      await executor.run(baseOptions);

      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
    });
  });
});
