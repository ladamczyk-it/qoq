import { EExitCode, executeCommand } from '@ladamczyk/qoq-utils';
import { dummyModulesConfig } from '__tests__/common.ts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { IExecutorOptions } from '../types.ts';

import { JscpdExecutor } from './JscpdExecutor.ts';

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

const configWithJscpd = {
  ...dummyModulesConfig,
  srcPath: 'src',
  modules: { jscpd: { format: ['typescript', 'tsx'], threshold: 5, ignore: ['dist'] } },
};

const getArgs = (): string[] => {
  const [[, args]] = vi.mocked(executeCommand).mock.calls;

  return args as string[];
};

describe('JscpdExecutor', () => {
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
    it('should return the upper-cased command name', () => {
      expect(new JscpdExecutor(configWithJscpd, true, true).getName()).toBe('JSCPD');
    });
  });

  describe('run', () => {
    it('should build the command args from the jscpd config', async () => {
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      await executor.run(baseOptions);

      expect(getArgs()).toStrictEqual([
        'src',
        '-a',
        '-f',
        'typescript,tsx',
        '-t',
        '5',
        '-i',
        'dist',
      ]);
    });

    it('should append the json reporter and output when json is requested', async () => {
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      await executor.run({ ...baseOptions, json: 'true' });

      expect(getArgs()).toContain('--reporters json --output "out"');
    });
  });
});
