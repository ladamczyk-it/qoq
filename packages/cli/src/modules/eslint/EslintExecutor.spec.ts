import { writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { EConfigType } from '../../helpers/types.ts';
import { IExecutorOptions } from '../types.ts';

import { EslintExecutor } from './EslintExecutor.ts';
import { EModulesEslint } from './types.ts';

const { lintFiles, loadFormatter, outputFixes, format, getOptions, ESLint } = vi.hoisted(() => {
  const lintFilesMock = vi.fn();
  const formatMock = vi.fn();
  const loadFormatterMock = vi.fn(() => Promise.resolve({ format: formatMock }));
  const outputFixesMock = vi.fn();
  let lastOptions: Record<string, unknown> = {};

  class MockESLint {
    lintFiles = lintFilesMock;
    loadFormatter = loadFormatterMock;

    constructor(options: Record<string, unknown>) {
      lastOptions = options;
    }
  }

  // `outputFixes` is a static method on the real ESLint class; attach it here as a
  // property (rather than a static field) to keep the camelCase name lint-clean.
  (MockESLint as unknown as { outputFixes: typeof outputFixesMock }).outputFixes = outputFixesMock;

  return {
    lintFiles: lintFilesMock,
    loadFormatter: loadFormatterMock,
    outputFixes: outputFixesMock,
    format: formatMock,
    getOptions: () => lastOptions,
    ESLint: MockESLint,
  };
});

vi.mock('eslint', () => ({ ESLint }));

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  writeFileSync: vi.fn(),
}));

// Points resolveTargets()'s dynamic import at a path that can never resolve, so
// the import genuinely fails (a real Node ERR_MODULE_NOT_FOUND, not a mocked
// rejection) — exercising the same failure the wrapped error is meant to name.
vi.mock('url', async (importOriginal) => ({
  ...(await importOriginal<typeof import('url')>()),
  pathToFileURL: () => new URL('file:///qoq-test-nonexistent-dir/eslint.config.mjs'),
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

// Shared by both top-level describes below (split apart to keep each function under
// this repo's max-lines-per-function) so the mock lifecycle isn't duplicated.
const setupMocks = (): void => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  vi.spyOn(console, 'time').mockImplementation(() => undefined);
  vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
  lintFiles.mockResolvedValue([okResult]);
  format.mockResolvedValue('');
};

const teardownMocks = (): void => {
  vi.restoreAllMocks();
  lintFiles.mockReset();
  loadFormatter.mockClear();
  outputFixes.mockReset();
  format.mockReset();
  vi.mocked(writeFileSync).mockClear();
};

describe('EslintExecutor', () => {
  beforeEach(setupMocks);
  afterEach(teardownMocks);

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

    it('should name the config file and surface the original failure as cause when the generated config cannot be imported', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const executor = new EslintExecutor(configWithEslint, true, true);

      await executor.run(baseOptions, ['src/index.ts']);

      expect(exitMock).toHaveBeenCalledWith(EExitCode.EXCEPTION);
      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining('Failed to import the generated ESLint config at')
      );
      expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Caused by:'));
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
});

const configWithTemplate = {
  ...dummyModulesConfig,
  modules: {
    eslint: [{ template: EModulesEslint.ESLINT_V9_TS, files: ['src/**/*.ts'], ignores: [] }],
  },
};

const writtenConfig = () => (vi.mocked(writeFileSync).mock.calls[0]?.[1] as string) ?? '';

describe('EslintExecutor generated config', () => {
  beforeEach(setupMocks);
  afterEach(teardownMocks);

  describe('workspaces', () => {
    it('restores import-x/no-cycle ignoreExternal:false ahead of user overrides when workspaces are detected', async () => {
      const executor = new EslintExecutor(
        { ...configWithTemplate, workspaces: ['packages/*'] },
        true,
        true
      );

      await executor.run(baseOptions);

      // defineConfig expands `extends` in order and appends the extending object
      // (the user's qoq.config.js block) last, so this ordering is what makes the
      // user's own rules win over both monorepo overrides.
      expect(writtenConfig()).toContain(
        'const config0 = defineConfig({ extends: [configs0.base, ' +
          '{"rules":{"import-x/no-cycle":[1,{"ignoreExternal":false}]}}, ' +
          "{ settings: { 'import-x/resolver-next': [createTypeScriptImportResolver({ project: " +
          '["packages/*/tsconfig.json","tsconfig.json"], noWarnOnMultipleProjects: true }), ' +
          'createNodeResolver()] } }], ...{"files":["src/**/*.ts"],"ignores":[]} })'
      );
    });

    it('leaves the template default (ignoreExternal:true) untouched when workspaces are not detected', async () => {
      const executor = new EslintExecutor(configWithTemplate, true, true);

      await executor.run(baseOptions);

      expect(writtenConfig()).not.toContain('import-x/no-cycle');
    });

    it('points the TypeScript resolver at every workspace tsconfig when workspaces are detected on a ts template', async () => {
      const executor = new EslintExecutor(
        { ...configWithTemplate, workspaces: ['packages/*'] },
        true,
        true
      );

      await executor.run(baseOptions);

      expect(writtenConfig()).toContain(
        'createTypeScriptImportResolver({ project: ["packages/*/tsconfig.json","tsconfig.json"], noWarnOnMultipleProjects: true })'
      );
      expect(writtenConfig()).toContain(
        "import { createTypeScriptImportResolver, createNodeResolver } from '@ladamczyk/qoq-eslint-v9-ts'"
      );
    });

    it('leaves the resolver untouched when workspaces are not detected', async () => {
      const executor = new EslintExecutor(configWithTemplate, true, true);

      await executor.run(baseOptions);

      expect(writtenConfig()).not.toContain('createTypeScriptImportResolver');
    });

    it('does not override the resolver for non-ts templates even when workspaces are detected', async () => {
      const configWithJsTemplate = {
        ...dummyModulesConfig,
        modules: {
          eslint: [{ template: EModulesEslint.ESLINT_V9_JS, files: ['src/**/*.js'], ignores: [] }],
        },
        workspaces: ['packages/*'],
      };
      const executor = new EslintExecutor(configWithJsTemplate, true, true);

      await executor.run(baseOptions);

      expect(writtenConfig()).not.toContain('createTypeScriptImportResolver');
      expect(writtenConfig()).toContain('import-x/no-cycle');
    });
  });

  describe('composition', () => {
    it('extends the template configs.base through defineConfig in ESM form', async () => {
      const executor = new EslintExecutor(configWithTemplate, true, true);

      await executor.run(baseOptions);

      expect(writtenConfig()).toContain(
        "import { defineConfig } from 'eslint/config';" +
          "import { includeIgnoreFile } from '@eslint/compat';" +
          "import { configs as configs0 } from '@ladamczyk/qoq-eslint-v9-ts';" +
          'const config0 = defineConfig({ extends: [configs0.base], ' +
          '...{"files":["src/**/*.ts"],"ignores":[]} });'
      );
      expect(writtenConfig().endsWith('.concat(config0);')).toBe(true);
    });

    it('extends the template configs.base through defineConfig in CJS form', async () => {
      const executor = new EslintExecutor(
        { ...configWithTemplate, configType: EConfigType.CJS },
        true,
        true
      );

      await executor.run(baseOptions);

      expect(writtenConfig()).toContain(
        "const { defineConfig } = require('eslint/config');" +
          "const { includeIgnoreFile } = require('@eslint/compat');" +
          "const { configs: configs0 } = require('@ladamczyk/qoq-eslint-v9-ts');" +
          'const config0 = defineConfig({ extends: [configs0.base], ' +
          '...{"files":["src/**/*.ts"],"ignores":[]} });'
      );
    });

    it('never emits a qoq-utils import', async () => {
      const executor = new EslintExecutor(
        { ...configWithTemplate, workspaces: ['packages/*'] },
        true,
        true
      );

      await executor.run(baseOptions);

      expect(writtenConfig()).not.toContain('@ladamczyk/qoq-utils');
    });

    it('emits a bare config array with no template import for an entry without a template', async () => {
      const executor = new EslintExecutor(
        { ...dummyModulesConfig, modules: { eslint: [{ files: ['**/*.md'] }] } },
        true,
        true
      );

      await executor.run(baseOptions);

      expect(writtenConfig()).toContain('const config0 = [{"files":["**/*.md"]}]');
      expect(writtenConfig()).not.toContain('configs0');
    });
  });
});
