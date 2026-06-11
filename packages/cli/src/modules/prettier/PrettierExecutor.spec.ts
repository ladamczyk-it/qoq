import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { EExitCode, executeCommand } from '@ladamczyk/qoq-utils';
import { dummyModulesConfig } from '__tests__/common.ts';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

import * as common from '../../helpers/common.ts';
import { IExecutorOptions } from '../types.ts';

import { PrettierExecutor } from './PrettierExecutor.ts';

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

describe('PrettierExecutor', () => {
  const executor = new PrettierExecutor(dummyModulesConfig, true, true);

  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(executeCommand).mockReset();
  });

  describe('getName', () => {
    it('should return the capitalized command name', () => {
      expect(executor.getName()).toBe('Prettier');
    });
  });

  describe('execute (plain mode)', () => {
    it('should delegate to executeCommand and return its exit code', async () => {
      vi.mocked(executeCommand).mockResolvedValue(EExitCode.OK as never);

      const result = await executor.run(baseOptions);

      expect(executeCommand).toHaveBeenCalledWith(
        'prettier',
        expect.arrayContaining(['--check']),
        'inherit',
        false
      );
      expect(result).toBe(EExitCode.OK);
    });
  });

  describe('execute (json mode)', () => {
    let outputDir: string;

    beforeAll(() => {
      outputDir = mkdtempSync(join(tmpdir(), 'qoq-prettier-'));
    });

    afterAll(() => {
      rmSync(outputDir, { recursive: true, force: true });
    });

    const readReport = (): { issues: string[] } =>
      JSON.parse(readFileSync(join(outputDir, 'prettier-report.json'), 'utf8')) as {
        issues: string[];
      };

    it('should swap --check for --list-different, write the report and return ERROR when issues exist', async () => {
      vi.mocked(executeCommand).mockResolvedValue('a.ts\nb.ts\n');

      const result = await executor.run({ ...baseOptions, json: 'true', output: outputDir });

      const [firstCall] = vi.mocked(executeCommand).mock.calls;
      const [, args] = firstCall ?? [];
      expect(args).toContain('--list-different');
      expect(args).not.toContain('--check');
      expect(result).toBe(EExitCode.ERROR);
      expect(readReport()).toStrictEqual({ issues: ['a.ts', 'b.ts'] });
    });

    it('should write an empty report and return OK when there are no issues', async () => {
      vi.mocked(executeCommand).mockResolvedValue('');

      const result = await executor.run({ ...baseOptions, json: 'true', output: outputDir });

      expect(result).toBe(EExitCode.OK);
      expect(readReport()).toStrictEqual({ issues: [] });
    });
  });

  describe('prepare (file filtering)', () => {
    it('should drop files matching ignore patterns before checking', async () => {
      vi.spyOn(common, 'readIgnorePatterns').mockResolvedValue(['node_modules/**']);
      vi.mocked(executeCommand).mockResolvedValue(EExitCode.OK as never);

      await executor.run(baseOptions, ['src/a.ts', 'node_modules/b.ts']);

      const [firstCall] = vi.mocked(executeCommand).mock.calls;
      const [, args] = firstCall ?? [];
      expect(args).toContain('src/a.ts');
      expect(args).not.toContain('node_modules/b.ts');
    });

    it('should terminate gracefully (return OK) when every file is ignored', async () => {
      vi.spyOn(common, 'readIgnorePatterns').mockResolvedValue(['**']);
      vi.mocked(executeCommand).mockResolvedValue(EExitCode.OK as never);

      const result = await executor.run(baseOptions, ['src/a.ts']);

      expect(executeCommand).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });
  });
});
