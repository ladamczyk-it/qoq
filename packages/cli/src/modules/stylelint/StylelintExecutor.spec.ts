import { closeSync, mkdtempSync, openSync, rmSync, writeFileSync, writeSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { EExitCode } from '@ladamczyk/qoq-utils';
import { dummyModulesConfig } from '__tests__/common.ts';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { IExecutorOptions } from '../types.ts';

import { StylelintExecutor } from './StylelintExecutor.ts';
import { EModulesStylelint, TModuleStylelintConfig } from './types.ts';

const { lint } = vi.hoisted(() => ({
  lint: vi.fn(),
}));

vi.mock('stylelint', () => ({ default: { lint } }));

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

const configWith = (stylelint: TModuleStylelintConfig) => ({
  ...dummyModulesConfig,
  modules: { stylelint },
});

const passingResult = {
  results: [],
  errored: false,
  report: '',
  ruleMetadata: {},
};

const lintArg = () => {
  const [firstCall] = vi.mocked(lint).mock.calls;
  const [arg] = firstCall ?? [];

  return arg as Record<string, unknown>;
};

describe('StylelintExecutor', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
    lint.mockResolvedValue(passingResult);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    lint.mockReset();
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

      expect(lint).not.toHaveBeenCalled();
      expect(result).toBe(EExitCode.OK);
    });

    it('should use the configured pattern as the lint target', async () => {
      const executor = new StylelintExecutor(
        configWith({ strict: false, pattern: 'src/**/*.css' }),
        true,
        true
      );

      await executor.run(baseOptions);

      const arg = lintArg();
      expect(arg.files).toEqual(['src/**/*.css']);
      expect(arg.configFile).toBeTruthy();
      expect(arg.maxWarnings).toBeUndefined();
    });

    it('should derive the glob from a scss template and set strict max warnings', async () => {
      const executor = new StylelintExecutor(
        configWith({ strict: true, template: EModulesStylelint.STYLELINT_SCSS }),
        true,
        true
      );

      await executor.run(baseOptions);

      const arg = lintArg();
      expect((arg.files as string[])[0]).toContain('/**/*.{css,scss,sass}');
      expect(arg.maxWarnings).toBe(0);
    });

    it('should write a JSON report when json is requested', async () => {
      lint.mockResolvedValue({
        ...passingResult,
        results: [{ source: 'a.css', warnings: [{ rule: 'color-hex-length', line: 1 }] }],
        ruleMetadata: { 'color-hex-length': { fixable: true } },
      });
      const executor = new StylelintExecutor(
        configWith({ strict: false, template: EModulesStylelint.STYLELINT_CSS }),
        true,
        true
      );

      await executor.run({ ...baseOptions, json: 'true' });

      expect(writeFileSync).toHaveBeenCalledWith(
        'out/stylelint-report.json',
        expect.stringContaining('"fixable":true')
      );
    });

    it('should return ERROR when stylelint reports errors', async () => {
      lint.mockResolvedValue({ ...passingResult, errored: true });
      const executor = new StylelintExecutor(
        configWith({ strict: false, template: EModulesStylelint.STYLELINT_CSS }),
        true,
        true
      );

      const result = await executor.run(baseOptions);

      expect(result).toBe(EExitCode.ERROR);
    });

    it('should report and exit on an invalid config', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const executor = new StylelintExecutor(configWith({ strict: false }), true, true);

      await executor.run(baseOptions);

      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
    });
  });

  describe('progress', () => {
    it('should load the generated config, append the progress plugin, and pass it as `config` (never together with `configFile`) when not silent', async () => {
      const workdir = mkdtempSync(join(tmpdir(), 'qoq-stylelint-'));
      const fd = openSync(join(workdir, 'stylelint.config.js'), 'w');
      writeSync(fd, 'export default { rules: {} };\n');
      closeSync(fd);
      const cwd = process.cwd();
      process.chdir(workdir);

      try {
        const executor = new StylelintExecutor(
          {
            ...configWith({ strict: false, template: EModulesStylelint.STYLELINT_CSS }),
            configPaths: { ...dummyModulesConfig.configPaths, stylelint: '/stylelint.config.js' },
          },
          false,
          true
        );

        await executor.run(baseOptions);

        const arg = lintArg();
        expect(arg.configFile).toBeUndefined();
        const config = arg.config as { plugins: unknown[]; rules: Record<string, unknown> };
        expect(config.plugins).toHaveLength(1);
        expect(config.rules['qoq-internal/file-progress']).toBe(true);
      } finally {
        process.chdir(cwd);
        rmSync(workdir, { recursive: true, force: true });
      }
    });

    it('should not append a progress plugin when silent', async () => {
      const executor = new StylelintExecutor(
        configWith({ strict: false, template: EModulesStylelint.STYLELINT_CSS }),
        true,
        true
      );

      await executor.run(baseOptions);

      const arg = lintArg();
      expect(arg.configFile).toBeTruthy();
      expect(arg.config).toBeUndefined();
    });
  });
});
