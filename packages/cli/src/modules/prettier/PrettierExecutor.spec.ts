import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { EExitCode } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { IExecutorOptions } from '../types.ts';

import { PrettierExecutor } from './PrettierExecutor.ts';

const { check, format, getFileInfo, resolveConfig } = vi.hoisted(() => ({
  check: vi.fn(),
  format: vi.fn(),
  getFileInfo: vi.fn(),
  resolveConfig: vi.fn(),
}));

vi.mock('prettier', () => ({ check, format, getFileInfo, resolveConfig }));

const baseOptions: IExecutorOptions = {
  output: '',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

const config = {
  ...dummyModulesConfig,
  modules: { prettier: { sources: ['.'] } },
};

describe('PrettierExecutor', () => {
  const executor = new PrettierExecutor(config, true, true);
  let workdir: string;
  let cacheDir: string;
  let cwd: string;
  let cachePath: string;
  let stdout: ReturnType<typeof vi.spyOn>;
  let stderr: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'qoq-prettier-'));
    writeFileSync(join(workdir, 'a.ts'), 'const a=1');
    writeFileSync(join(workdir, 'b.ts'), 'const b=2');
    cwd = process.cwd();
    process.chdir(workdir);

    // Redirect the real (repo-relative) cache path to a scratch dir *outside*
    // workdir — the prettier `sources: ['.']` config would otherwise pick the
    // cache file itself up as a lint target.
    cacheDir = mkdtempSync(join(tmpdir(), 'qoq-prettier-cache-'));
    cachePath = join(cacheDir, '.prettiercache');
    (PrettierExecutor as unknown as { CACHE_PATH: string }).CACHE_PATH = cachePath;

    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);

    getFileInfo.mockResolvedValue({ ignored: false, inferredParser: 'typescript' });
    check.mockResolvedValue(true);
    format.mockImplementation((source: string) => Promise.resolve(source));
    resolveConfig.mockResolvedValue({});
  });

  afterEach(() => {
    process.chdir(cwd);
    rmSync(workdir, { recursive: true, force: true });
    rmSync(cacheDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('getName', () => {
    it('should return the capitalized command name', () => {
      expect(executor.getName()).toBe('Prettier');
    });
  });

  describe('check mode', () => {
    it('should return OK and report a clean run when every file is formatted', async () => {
      const result = await executor.run(baseOptions);

      expect(check).toHaveBeenCalledTimes(2);
      expect(stdout).toHaveBeenCalledWith('All matched files use Prettier code style!\n');
      expect(result).toBe(EExitCode.OK);
    });

    it('should return ERROR and warn about files that are not formatted', async () => {
      check.mockResolvedValueOnce(false);

      const result = await executor.run(baseOptions);

      expect(result).toBe(EExitCode.ERROR);
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining('a.ts'));
    });

    it('should skip ignored files and files with no inferable parser', async () => {
      getFileInfo.mockResolvedValue({ ignored: true, inferredParser: null });

      const result = await executor.run(baseOptions);

      expect(check).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });
  });

  describe('fix mode', () => {
    it('should write reformatted files and return OK', async () => {
      format.mockResolvedValue('FIXED');

      const result = await executor.run({ ...baseOptions, fix: true });

      expect(readFileSync(join(workdir, 'a.ts'), 'utf8')).toBe('FIXED');
      expect(readFileSync(join(workdir, 'b.ts'), 'utf8')).toBe('FIXED');
      expect(result).toBe(EExitCode.OK);
    });

    it('should print no per-file lines, only the final summary, mirroring ESLint', async () => {
      format.mockResolvedValue('FIXED');

      await executor.run({ ...baseOptions, fix: true });

      expect(stdout).not.toHaveBeenCalledWith(expect.stringContaining('a.ts'));
      expect(stdout).not.toHaveBeenCalledWith(expect.stringContaining('b.ts'));
      expect(stderr).toHaveBeenCalledWith(
        expect.stringContaining('Code style issues fixed in 2 files.')
      );
    });

    it('should stay silent per-file when a file is already formatted', async () => {
      format.mockImplementation((source: string) => Promise.resolve(source));

      const result = await executor.run({ ...baseOptions, fix: true });

      expect(stdout).toHaveBeenCalledWith('All matched files use Prettier code style!\n');
      expect(result).toBe(EExitCode.OK);
    });

    it('should report a formatting error via the aggregate count, not a per-file line', async () => {
      format.mockRejectedValueOnce(new Error('boom'));

      const result = await executor.run({ ...baseOptions, fix: true });

      expect(stderr).not.toHaveBeenCalled();
      expect(stdout).toHaveBeenCalledWith('Error occurred when checking code style in 1 file.\n');
      expect(result).toBe(EExitCode.EXCEPTION);
    });
  });

  describe('progress', () => {
    it('should print per-file progress and clear it before the final summary when not silent', async () => {
      const progressExecutor = new PrettierExecutor(config, false, true);

      const result = await progressExecutor.run(baseOptions);

      expect(stdout).toHaveBeenCalledWith(expect.stringContaining('a.ts'));
      expect(stdout).toHaveBeenCalledWith(expect.stringContaining('b.ts'));
      expect(stdout).toHaveBeenCalledWith('All matched files use Prettier code style!\n');
      expect(result).toBe(EExitCode.OK);
    });

    it('should not print progress when silent', async () => {
      await executor.run(baseOptions);

      expect(stdout).not.toHaveBeenCalledWith(expect.stringContaining('Processing:'));
    });
  });

  describe('json mode', () => {
    const readReport = (): { issues: string[] } =>
      JSON.parse(readFileSync(join(workdir, 'prettier-report.json'), 'utf8')) as {
        issues: string[];
      };

    it('should write the unformatted files to the report and return ERROR', async () => {
      check.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      const result = await executor.run({ ...baseOptions, json: 'true', output: workdir });

      expect(result).toBe(EExitCode.ERROR);
      expect(readReport()).toStrictEqual({ issues: ['a.ts'] });
      expect(stdout).not.toHaveBeenCalled();
    });

    it('should write an empty report and return OK when there are no issues', async () => {
      const result = await executor.run({ ...baseOptions, json: 'true', output: workdir });

      expect(result).toBe(EExitCode.OK);
      expect(readReport()).toStrictEqual({ issues: [] });
    });
  });

  describe('cache', () => {
    it('should not read or write a cache file when caching is disabled', async () => {
      await executor.run({ ...baseOptions, disableCache: true });

      expect(existsSync(cachePath)).toBe(false);
    });

    it('should skip rechecking clean, unchanged files on a later run', async () => {
      await executor.run({ ...baseOptions, disableCache: false });

      expect(existsSync(cachePath)).toBe(true);
      check.mockClear();

      const result = await executor.run({ ...baseOptions, disableCache: false });

      expect(check).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });

    it('should recheck only the files that changed since the cached run', async () => {
      await executor.run({ ...baseOptions, disableCache: false });

      check.mockClear();
      writeFileSync(join(workdir, 'a.ts'), 'const a = 100');

      const result = await executor.run({ ...baseOptions, disableCache: false });

      expect(check).toHaveBeenCalledTimes(1);
      expect(result).toBe(EExitCode.OK);
    });

    it('should cache a freshly fixed file so a later check run skips it entirely', async () => {
      format.mockResolvedValueOnce('FIXED');

      await executor.run({ ...baseOptions, disableCache: false, fix: true });

      check.mockClear();

      const result = await executor.run({ ...baseOptions, disableCache: false });

      expect(check).not.toHaveBeenCalled();
      expect(stdout).toHaveBeenCalledWith('All matched files use Prettier code style!\n');
      expect(result).toBe(EExitCode.OK);
    });

    it('should never cache an unformatted file left unfixed', async () => {
      check.mockResolvedValueOnce(false);

      await executor.run({ ...baseOptions, disableCache: false });

      check.mockClear().mockResolvedValue(false);

      const result = await executor.run({ ...baseOptions, disableCache: false });

      expect(check).toHaveBeenCalledTimes(1);
      expect(result).toBe(EExitCode.ERROR);
    });
  });
});
