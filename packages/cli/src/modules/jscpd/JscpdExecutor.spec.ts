import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

import { EExitCode } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi, type MockInstance } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { IExecutorOptions } from '../types.ts';

import { JscpdExecutor } from './JscpdExecutor.ts';

const { runJscpd } = vi.hoisted(() => ({ runJscpd: vi.fn() }));

// The executor loads jscpd through createRequire, so we mock `module` rather
// than the `jscpd` specifier directly.
vi.mock('module', async (importOriginal) => {
  const actual = await importOriginal<typeof import('module')>();

  return {
    ...actual,
    createRequire: () => (id: string) => {
      if (id !== 'jscpd') {
        throw new Error(`Unexpected require: ${id}`);
      }

      return { runJscpd };
    },
  };
});

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  writeFileSync: vi.fn(),
}));

const { writeFileSync: realWriteFileSync } = await vi.importActual<typeof import('fs')>('fs');

const baseOptions: IExecutorOptions = {
  output: 'out',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

const configWithJscpd = {
  ...dummyModulesConfig,
  srcPath: 'src',
  modules: {
    jscpd: { format: ['typescript', 'tsx'], threshold: 5, ignore: ['dist', '**/*.spec.ts'] },
  },
};

const fileAt = (name: string, start: number, end: number) => ({
  name,
  start,
  end,
  startLoc: { line: start, column: 1, position: 0 },
  endLoc: { line: end, column: 1, position: 0 },
});

const getArgs = (): string[] => {
  const [firstCall] = runJscpd.mock.calls;

  return (firstCall?.[0] ?? []) as string[];
};

const getOutputDir = (args: string[]): string => args[args.indexOf('--output') + 1] ?? '';

// Stands in for the binary: writes a v5-shaped jscpd-report.json into the
// `--output` dir it was given, then returns a spawnSync-style result.
const jscpdReports = (percentage: number, duplicates: unknown[] = [], stdout = '') => {
  runJscpd.mockImplementation((args: string[]) => {
    realWriteFileSync(
      join(getOutputDir(args), 'jscpd-report.json'),
      JSON.stringify({ statistics: { total: { percentage, lines: 100 } }, duplicates })
    );

    return { status: percentage > 5 ? 1 : 0, stdout, stderr: '' };
  });
};

describe('JscpdExecutor', () => {
  let stdoutWrite: MockInstance<typeof process.stdout.write>;
  let stderrWrite: MockInstance<typeof process.stderr.write>;
  let exit: MockInstance<typeof process.exit>;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    jscpdReports(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    runJscpd.mockReset();
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

      expect(runJscpd).not.toHaveBeenCalled();
      expect(exitCode).toBe(EExitCode.OK);
    });

    it('should build the CLI args from the jscpd config, one --ignore per pattern', async () => {
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      await executor.run(baseOptions);

      const args = getArgs();
      expect(args).toStrictEqual([
        'src',
        '--absolute',
        '--format',
        'typescript,tsx',
        '--threshold',
        '5',
        '--no-tips',
        '--ignore',
        'dist',
        '--ignore',
        '**/*.spec.ts',
        '--reporters',
        'console,json',
        '--output',
        getOutputDir(args),
      ]);
      expect(runJscpd.mock.calls[0]?.[1]).toStrictEqual({
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    });

    it('should run silently with only the json reporter when json is requested', async () => {
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      await executor.run({ ...baseOptions, json: 'true' });

      expect(getArgs()).toStrictEqual(expect.arrayContaining(['--silent', '--reporters', 'json']));
      expect(getArgs()).not.toContain('console,json');
    });

    it('should remove its scratch report dir after the run', async () => {
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      await executor.run(baseOptions);

      expect(existsSync(getOutputDir(getArgs()))).toBe(false);
    });

    it('should print the console table without the saved-report and timer lines', async () => {
      jscpdReports(
        0,
        [],
        'Found 0 clones.\n\u001b[32mJSON report saved to /tmp/x/jscpd-report.json\u001b[39m\n\u001b[90mtime: 9ms\u001b[39m\n'
      );
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      await executor.run(baseOptions);

      expect(stdoutWrite).toHaveBeenCalledWith('Found 0 clones.\n');
    });

    it('should write a lean JSON report when json is requested', async () => {
      jscpdReports(1, [
        {
          format: 'typescript',
          lines: 12,
          tokens: 80,
          fragment: 'const a = 1;',
          isNew: false,
          kind: 'exact',
          firstFile: fileAt('src/a.ts', 4, 15),
          secondFile: fileAt('src/b.ts', 20, 31),
        },
      ]);
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
      jscpdReports(7);
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      expect(await executor.run(baseOptions)).toBe(EExitCode.ERROR);
    });

    it('should return OK when duplication stays within the threshold', async () => {
      jscpdReports(5);
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      expect(await executor.run(baseOptions)).toBe(EExitCode.OK);
    });

    it('should report jscpd own error, not a threshold verdict, when it writes no report', async () => {
      runJscpd.mockReturnValue({
        status: 1,
        stdout: '',
        stderr: 'Error: path does not exist: src\n',
      });
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      await executor.run(baseOptions);

      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining('jscpd: Error: path does not exist: src')
      );
      expect(exit).toHaveBeenCalledWith(EExitCode.EXCEPTION);
    });

    it('should print why when there is no jscpd binary for this platform', async () => {
      runJscpd.mockImplementation(() => {
        throw Object.assign(new Error('no prebuilt binary for this platform'), {
          code: 'JSCPD_NO_BINARY',
        });
      });
      const executor = new JscpdExecutor(configWithJscpd, true, true);

      await executor.run(baseOptions);

      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining('jscpd: no prebuilt binary for this platform')
      );
      expect(exit).toHaveBeenCalledWith(EExitCode.EXCEPTION);
    });
  });
});
