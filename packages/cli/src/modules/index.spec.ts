import { EExitCode } from '@ladamczyk/qoq-utils';
import { dummyModulesConfig } from '__tests__/common.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { execute } from './index.ts';
import { IExecutorOptions, IModulesConfig } from './types.ts';

const executors = vi.hoisted(() => {
  const make = (name: string) => {
    const run = vi.fn();

    class StubExecutor {
      run = run;
      getName = (): string => name;
    }

    return { run, ctor: StubExecutor };
  };

  return {
    npm: make('NPM'),
    knip: make('Knip'),
    prettier: make('Prettier'),
    jscpd: make('JSCPD'),
    eslint: make('Eslint'),
    stylelint: make('Stylelint'),
    structurelint: make('Structurelint'),
    skillslint: make('Skillslint'),
  };
});

vi.mock('./npm/NpmExecutor.ts', () => ({ NpmExecutor: executors.npm.ctor }));
vi.mock('./knip/KnipExecutor.ts', () => ({ KnipExecutor: executors.knip.ctor }));
vi.mock('./prettier/PrettierExecutor.ts', () => ({ PrettierExecutor: executors.prettier.ctor }));
vi.mock('./jscpd/JscpdExecutor.ts', () => ({ JscpdExecutor: executors.jscpd.ctor }));
vi.mock('./eslint/EslintExecutor.ts', () => ({ EslintExecutor: executors.eslint.ctor }));
vi.mock('./stylelint/StylelintExecutor.ts', () => ({
  StylelintExecutor: executors.stylelint.ctor,
}));
vi.mock('./structurelint/StructurelintExecutor.ts', () => ({
  StructurelintExecutor: executors.structurelint.ctor,
}));
vi.mock('./skillslint/SkillslintExecutor.ts', () => ({
  SkillslintExecutor: executors.skillslint.ctor,
}));

const baseOptions: IExecutorOptions = {
  output: '',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

const configWithLinters: IModulesConfig = {
  ...dummyModulesConfig,
  modules: {
    stylelint: { strict: false },
    structurelint: { path: '.' },
    skillslint: { path: './skills' },
  },
};

describe('execute', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    Object.values(executors).forEach(({ run }) => run.mockResolvedValue(EExitCode.OK));
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.values(executors).forEach(({ run }) => run.mockReset());
    process.exitCode = undefined;
  });

  it('should run every enabled tool when no skip flags are set', async () => {
    await execute(configWithLinters, baseOptions);

    Object.values(executors).forEach(({ run }) => {
      expect(run).toHaveBeenCalledOnce();
    });
  });

  it('should skip tools whose skip flag is set', async () => {
    await execute(configWithLinters, {
      ...baseOptions,
      skipNpm: true,
      skipKnip: true,
      skipPrettier: true,
      skipJscpd: true,
      skipEslint: true,
      skipStylelint: true,
      skipStructurelint: true,
      skipSkillslint: true,
    });

    expect(executors.npm.run).not.toHaveBeenCalled();
    expect(executors.knip.run).not.toHaveBeenCalled();
    expect(executors.prettier.run).not.toHaveBeenCalled();
    expect(executors.jscpd.run).not.toHaveBeenCalled();
    expect(executors.eslint.run).not.toHaveBeenCalled();
    expect(executors.stylelint.run).not.toHaveBeenCalled();
    expect(executors.structurelint.run).not.toHaveBeenCalled();
    expect(executors.skillslint.run).not.toHaveBeenCalled();
  });

  it('should not run stylelint, structurelint or skillslint when they are absent from the config', async () => {
    await execute(dummyModulesConfig, baseOptions);

    expect(executors.stylelint.run).not.toHaveBeenCalled();
    expect(executors.structurelint.run).not.toHaveBeenCalled();
    expect(executors.skillslint.run).not.toHaveBeenCalled();
    expect(executors.eslint.run).toHaveBeenCalledOnce();
  });

  it('should only run the tools named in the tools filter', async () => {
    await execute(configWithLinters, baseOptions, undefined, ['eslint']);

    expect(executors.eslint.run).toHaveBeenCalledOnce();
    expect(executors.npm.run).not.toHaveBeenCalled();
    expect(executors.prettier.run).not.toHaveBeenCalled();
    expect(executors.stylelint.run).not.toHaveBeenCalled();
  });

  it('should forward the files argument to each executor run', async () => {
    const files = ['src/a.ts', 'src/b.ts'];

    await execute(configWithLinters, baseOptions, files);

    expect(executors.eslint.run).toHaveBeenCalledWith(baseOptions, files);
    expect(executors.npm.run).toHaveBeenCalledWith(baseOptions, files, 'pipe');
  });

  it('should flag a non-OK exit code and report it on stderr', async () => {
    const stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    executors.eslint.run.mockResolvedValue(EExitCode.ERROR);

    await execute(configWithLinters, baseOptions);

    expect(process.exitCode).toBe(EExitCode.ERROR);
    expect(stderrMock).toHaveBeenCalledWith(expect.stringContaining('Eslint'));
  });

  it('should leave the exit code untouched when every tool succeeds', async () => {
    await execute(configWithLinters, baseOptions);

    expect(process.exitCode).toBeUndefined();
  });

  it('should print the timing footer when messages are not hidden', async () => {
    const stdoutMock = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await execute(configWithLinters, baseOptions);

    expect(stdoutMock).toHaveBeenCalledWith(expect.stringContaining('Total execution time:'));
  });

  it('should suppress the timing footer in silent mode', async () => {
    const stdoutMock = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await execute(configWithLinters, { ...baseOptions, silent: true });

    expect(stdoutMock).not.toHaveBeenCalledWith(expect.stringContaining('Total execution time:'));
  });
});
