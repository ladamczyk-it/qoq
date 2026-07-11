import { writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import { dummyModulesConfig } from '__tests__/common.ts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { IExecutorOptions } from '../types.ts';

import { EslintExecutor } from './EslintExecutor.ts';
import { EModulesEslint } from './types.ts';

const { lintFiles, loadFormatter, outputFixes, format, getOptions, ESLint } = vi.hoisted(() => {
  const lintFiles = vi.fn();
  const format = vi.fn();
  const loadFormatter = vi.fn(() => Promise.resolve({ format }));
  const outputFixes = vi.fn();
  let lastOptions: Record<string, unknown> = {};

  class ESLint {
    lintFiles = lintFiles;
    loadFormatter = loadFormatter;

    constructor(options: Record<string, unknown>) {
      lastOptions = options;
    }
  }

  // `outputFixes` is a static method on the real ESLint class; attach it here as a
  // property (rather than a static field) to keep the camelCase name lint-clean.
  (ESLint as unknown as { outputFixes: typeof outputFixes }).outputFixes = outputFixes;

  return { lintFiles, loadFormatter, outputFixes, format, getOptions: () => lastOptions, ESLint };
});

vi.mock('eslint', () => ({ ESLint }));

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

const configWithEslint = {
  ...dummyModulesConfig,
  modules: { eslint: [] },
};

const okResult = {
  filePath: '/repo/src/index.ts',
  messages: [],
  errorCount: 0,
  warningCount: 0,
};

describe('EslintExecutor', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
    lintFiles.mockResolvedValue([okResult]);
    format.mockResolvedValue('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    lintFiles.mockReset();
    loadFormatter.mockClear();
    outputFixes.mockReset();
    format.mockReset();
    vi.mocked(writeFileSync).mockClear();
  });

  describe('getName', () => {
    it('should return the capitalized command name', () => {
      expect(new EslintExecutor(dummyModulesConfig, true, true).getName()).toBe('Eslint');
    });
  });

  describe('run', () => {
    it('should write the generated config and lint the cwd when no files are given', async () => {
      const executor = new EslintExecutor(configWithEslint, true, true);

      const result = await executor.run(baseOptions);

      expect(writeFileSync).toHaveBeenCalled();
      expect(lintFiles).toHaveBeenCalledWith(['.']);
      expect(getOptions().overrideConfigFile).toBeTruthy();
      expect(result).toBe(EExitCode.OK);
    });

    it('should enable fixing and flush fixes to disk when fix is requested', async () => {
      const executor = new EslintExecutor(configWithEslint, true, true);

      await executor.run({ ...baseOptions, fix: true });

      expect(getOptions().fix).toBe(true);
      expect(outputFixes).toHaveBeenCalledWith([okResult]);
    });

    it('should forward the concurrency option to the eslint instance', async () => {
      const executor = new EslintExecutor(configWithEslint, true, true);

      await executor.run({ ...baseOptions, concurrency: 'auto' });

      expect(getOptions().concurrency).toBe('auto');
    });

    it('should write a lean JSON report when json is requested', async () => {
      lintFiles.mockResolvedValue([
        {
          filePath: '/repo/src/index.ts',
          messages: [
            {
              ruleId: 'no-unused-vars',
              severity: 2,
              message: 'x is unused',
              line: 3,
              column: 5,
              fix: { range: [0, 1], text: '' },
            },
          ],
          errorCount: 1,
          warningCount: 0,
        },
      ]);
      const executor = new EslintExecutor(configWithEslint, true, true);

      await executor.run({ ...baseOptions, json: 'true' });

      expect(loadFormatter).not.toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalledWith(
        'out/eslint-report.json',
        expect.stringContaining('"fix":true')
      );
    });

    it('should format with the stylish formatter when json is not requested', async () => {
      const executor = new EslintExecutor(configWithEslint, true, true);

      await executor.run(baseOptions);

      expect(loadFormatter).toHaveBeenCalledWith('stylish');
    });

    it('should return ERROR when eslint reports errors', async () => {
      lintFiles.mockResolvedValue([{ ...okResult, messages: [{}], errorCount: 1 }]);
      const executor = new EslintExecutor(configWithEslint, true, true);

      const result = await executor.run(baseOptions);

      expect(result).toBe(EExitCode.ERROR);
    });

    it('should fail on warnings, mirroring --max-warnings 0', async () => {
      const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      lintFiles.mockResolvedValue([{ ...okResult, messages: [{}], warningCount: 1 }]);
      const executor = new EslintExecutor(configWithEslint, true, true);

      const result = await executor.run(baseOptions);

      expect(result).toBe(EExitCode.ERROR);
      expect(stderrWrite).toHaveBeenCalledWith('ESLint found too many warnings (maximum: 0).\n');
    });

    it('should report and exit when config writing throws', async () => {
      vi.mocked(writeFileSync).mockImplementationOnce(() => {
        throw new Error('boom');
      });
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const executor = new EslintExecutor(configWithEslint, true, true);

      await executor.run(baseOptions);

      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
    });

    it('should inject a progress override config and print a done line when not silent', async () => {
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const executor = new EslintExecutor(configWithEslint, false, true);

      await executor.run(baseOptions);

      expect(getOptions().overrideConfig).toBeTruthy();
      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('Eslint done.\n'));
    });

    it('should still print progress for cache-hit files the live rule never visited', async () => {
      // The mocked ESLint never actually invokes the injected rule's create()
      // (unlike the real linter, which skips it for cached files too), so this
      // exercises the same fallback path: every result should still get a
      // progress line even though the rule reported none.
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const executor = new EslintExecutor(configWithEslint, false, true);

      await executor.run(baseOptions);

      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('src/index.ts'));
    });

    it('should not inject a progress override config when silent', async () => {
      const executor = new EslintExecutor(configWithEslint, true, true);

      await executor.run(baseOptions);

      expect(getOptions().overrideConfig).toBeUndefined();
    });

    it('should not inject a progress override config under --json', async () => {
      const executor = new EslintExecutor(configWithEslint, false, true);

      await executor.run({ ...baseOptions, json: 'true' });

      expect(getOptions().overrideConfig).toBeUndefined();
    });
  });

  describe('ci', () => {
    const configWithTemplate = {
      ...dummyModulesConfig,
      modules: {
        eslint: [{ template: EModulesEslint.ESLINT_V9_TS, files: ['src/**/*.ts'], ignores: [] }],
      },
    };

    const writtenConfig = () => (vi.mocked(writeFileSync).mock.calls[0]?.[1] as string) ?? '';

    it('strips the prettier plugin from template-based configs when ci is set', async () => {
      const executor = new EslintExecutor(configWithTemplate, true, true);

      await executor.run({ ...baseOptions, ci: true });

      expect(writtenConfig()).toContain('stripPrettierPlugin(objectMergeRight(baseConfig0');
      expect(writtenConfig()).toContain(
        "import { stripPrettierPlugin } from '@ladamczyk/qoq-utils'"
      );
    });

    it('leaves template-based configs untouched when ci is not set', async () => {
      const executor = new EslintExecutor(configWithTemplate, true, true);

      await executor.run({ ...baseOptions, ci: false });

      expect(writtenConfig()).not.toContain('stripPrettierPlugin');
    });

    it('does not import stripPrettierPlugin when no eslint modules use a template', async () => {
      const executor = new EslintExecutor(configWithEslint, true, true);

      await executor.run({ ...baseOptions, ci: true });

      expect(writtenConfig()).not.toContain('stripPrettierPlugin');
    });
  });

  describe('workspaces', () => {
    const configWithTemplate = {
      ...dummyModulesConfig,
      modules: {
        eslint: [{ template: EModulesEslint.ESLINT_V9_TS, files: ['src/**/*.ts'], ignores: [] }],
      },
    };

    const writtenConfig = () => (vi.mocked(writeFileSync).mock.calls[0]?.[1] as string) ?? '';

    it('restores import-x/no-cycle ignoreExternal:false ahead of user overrides when workspaces are detected', async () => {
      const executor = new EslintExecutor(
        { ...configWithTemplate, workspaces: ['packages/*'] },
        true,
        true
      );

      await executor.run(baseOptions);

      expect(writtenConfig()).toContain(
        'objectMergeRight(baseConfig0, {"rules":{"import-x/no-cycle":[1,{"ignoreExternal":false}]}}, {'
      );
    });

    it('leaves the template default (ignoreExternal:true) untouched when workspaces are not detected', async () => {
      const executor = new EslintExecutor(configWithTemplate, true, true);

      await executor.run(baseOptions);

      expect(writtenConfig()).not.toContain('import-x/no-cycle');
    });
  });
});
