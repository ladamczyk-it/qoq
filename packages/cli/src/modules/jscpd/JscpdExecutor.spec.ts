import { writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import { dummyModulesConfig } from '__tests__/common.ts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { IExecutorOptions } from '../types.ts';

import { JscpdExecutor } from './JscpdExecutor.ts';

const { detectClonesAndStatistic } = vi.hoisted(() => ({
  detectClonesAndStatistic: vi.fn(),
}));

// The executor loads jscpd's CJS build via createRequire (its ESM entry is
// broken), so we mock `module` rather than the `jscpd` specifier directly.
vi.mock('module', async (importOriginal) => {
  const actual = await importOriginal<typeof import('module')>();

  return {
    ...actual,
    createRequire: () => (id: string) => {
      if (id !== 'jscpd') {
        throw new Error(`Unexpected require: ${id}`);
      }

      return { detectClonesAndStatistic };
    },
  };
});

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  writeFileSync: vi.fn(),
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

const cloneAt = (sourceId: string, start: number, end: number) => ({
  sourceId,
  start: { line: start },
  end: { line: end },
});

const result = (percentage: number, clones: unknown[] = []) => ({
  clones,
  statistic: { total: { percentage } },
});

const getOptions = () => {
  const [firstCall] = vi.mocked(detectClonesAndStatistic).mock.calls;
  const [options] = firstCall ?? [];

  return options as Record<string, unknown>;
};

describe('JscpdExecutor', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
    detectClonesAndStatistic.mockResolvedValue(result(0));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    detectClonesAndStatistic.mockReset();
    vi.mocked(writeFileSync).mockReset();
  });

  describe('getName', () => {
    it('should return the upper-cased command name', () => {
      expect(new JscpdExecutor(configWithJscpd, true, true).getName()).toBe('JSCPD');
    });
  });

  describe('run', () => {
    it('should terminate gracefully (return OK) when there is no jscpd config', async () => {
      const executor = new JscpdExecutor(dummyModulesConfig, true, true);

      const exitCode = await executor.run(baseOptions);

      expect(detectClonesAndStatistic).not.toHaveBeenCalled();
      expect(exitCode).toBe(EExitCode.OK);
    });

    it('should build the detection options from the jscpd config', async () => {
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      await executor.run(baseOptions);

      expect(getOptions()).toStrictEqual({
        path: ['src'],
        absolute: true,
        format: ['typescript', 'tsx'],
        threshold: 5,
        ignore: ['dist'],
        noTips: true,
        silent: false,
        reporters: ['console'],
      });
    });

    it('should run silently with no console reporter when json is requested', async () => {
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      await executor.run({ ...baseOptions, json: 'true' });

      expect(getOptions()).toMatchObject({ silent: true, reporters: [] });
    });

    it('should write a lean JSON report when json is requested', async () => {
      detectClonesAndStatistic.mockResolvedValue(
        result(1, [
          {
            format: 'typescript',
            duplicationA: cloneAt('src/a.ts', 4, 15),
            duplicationB: cloneAt('src/b.ts', 20, 31),
          },
        ])
      );
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      await executor.run({ ...baseOptions, json: 'true' });

      const [path, payload] = vi.mocked(writeFileSync).mock.calls[0] ?? [];
      expect(path).toBe('out/jscpd-report.json');
      expect(JSON.parse(payload as string)).toStrictEqual({
        percentage: 1,
        clones: [
          {
            format: 'typescript',
            lines: 12,
            firstFile: { name: 'src/a.ts', start: 4, end: 15 },
            secondFile: { name: 'src/b.ts', start: 20, end: 31 },
          },
        ],
      });
    });

    it('should return ERROR when duplication exceeds the threshold', async () => {
      detectClonesAndStatistic.mockResolvedValue(result(7));
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      expect(await executor.run(baseOptions)).toBe(EExitCode.ERROR);
    });

    it('should return OK when duplication stays within the threshold', async () => {
      detectClonesAndStatistic.mockResolvedValue(result(5));
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      expect(await executor.run(baseOptions)).toBe(EExitCode.OK);
    });
  });
});
