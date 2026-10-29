import { EExitCode } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { suggestSkill } from '../helpers/skillHint.ts';
import { sendStats } from '../helpers/stats.ts';

import { execute, getConfig, scan } from './index.ts';
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
    justifyDisable: make('Justify-disable'),
  };
});

const scanExecutor = vi.hoisted(() => {
  const run = vi.fn();
  const ctor = vi.fn(function () {
    return { run };
  });

  return { run, ctor };
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

vi.mock('./justify-disable/JustifyDisableExecutor.ts', () => ({
  JustifyDisableExecutor: executors.justifyDisable.ctor,
}));

const cosmiconfigSearch = vi.hoisted(() => vi.fn());

vi.mock('cosmiconfig', () => ({ cosmiconfig: () => ({ search: cosmiconfigSearch }) }));

vi.mock('./scan/ScanExecutor.ts', () => ({ ScanExecutor: scanExecutor.ctor }));
vi.mock('../helpers/skillHint.ts', () => ({
  printSkillHint: vi.fn(),
  shouldShowSkillHint: vi.fn().mockReturnValue(false),
  suggestSkill: vi.fn(),
}));
vi.mock('../helpers/stats.ts', () => ({
  askStatsConsent: vi.fn(),
  getUsedOptions: vi.fn().mockReturnValue([]),
  sendStats: vi.fn(),
  writeStatsConsent: vi.fn(),
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
    structurelint: { structure: [] },
    skillslint: { path: './skills' },
    justifyDisable: {},
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
    expect(executors.npm.run).toHaveBeenCalledWith(baseOptions, files);
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

  it('should run justify-disable after skillslint when modules.justifyDisable is set', async () => {
    await execute(configWithLinters, baseOptions);

    expect(executors.justifyDisable.run).toHaveBeenCalledOnce();
    expect(executors.justifyDisable.run.mock.invocationCallOrder[0]).toBeGreaterThan(
      executors.skillslint.run.mock.invocationCallOrder[0]!
    );
  });

  it('should not run justify-disable when modules.justifyDisable is absent from the config', async () => {
    await execute(dummyModulesConfig, baseOptions);

    expect(executors.justifyDisable.run).not.toHaveBeenCalled();
  });

  it('should not run justify-disable when skipJustifyDisable is set', async () => {
    await execute(configWithLinters, { ...baseOptions, skipJustifyDisable: true });

    expect(executors.justifyDisable.run).not.toHaveBeenCalled();
  });

  it('should run only justify-disable when it is the sole tool named in the tools filter', async () => {
    await execute(configWithLinters, baseOptions, undefined, ['justify-disable']);

    expect(executors.justifyDisable.run).toHaveBeenCalledOnce();
    expect(executors.eslint.run).not.toHaveBeenCalled();
    expect(executors.skillslint.run).not.toHaveBeenCalled();
  });

  it('should set exitCode to ERROR and suggest the fix skill when justify-disable fails', async () => {
    executors.justifyDisable.run.mockResolvedValue(EExitCode.ERROR);

    await execute(configWithLinters, baseOptions);

    expect(process.exitCode).toBe(EExitCode.ERROR);
    expect(suggestSkill).toHaveBeenCalledWith('fix');
  });
});

describe('scan', () => {
  beforeEach(() => {
    scanExecutor.run.mockResolvedValue(EExitCode.OK);
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  it('should set exitCode to 1 when the scan resolves ERROR', async () => {
    scanExecutor.run.mockResolvedValue(EExitCode.ERROR);

    await scan(dummyModulesConfig, baseOptions);

    expect(process.exitCode).toBe(1);
  });

  it('should leave exitCode unset when the scan resolves OK', async () => {
    await scan(dummyModulesConfig, baseOptions);

    expect(process.exitCode).toBeUndefined();
  });

  it('should construct ScanExecutor with config, silent, false and timeout', async () => {
    await scan(dummyModulesConfig, { ...baseOptions, silent: true }, 5000);

    expect(scanExecutor.ctor).toHaveBeenCalledWith(dummyModulesConfig, true, false, 5000);
    expect(scanExecutor.run).toHaveBeenCalledWith({ ...baseOptions, silent: true });
  });

  it('should send stats when stats is enabled', async () => {
    await scan({ ...dummyModulesConfig, stats: true }, baseOptions);

    expect(sendStats).toHaveBeenCalledOnce();
  });

  it('should not send stats when stats is disabled', async () => {
    await scan({ ...dummyModulesConfig, stats: false }, baseOptions);

    expect(sendStats).not.toHaveBeenCalled();
  });

  it('should never construct ScanExecutor from execute()', async () => {
    Object.values(executors).forEach(({ run }) => run.mockResolvedValue(EExitCode.OK));

    await execute(configWithLinters, { ...baseOptions, silent: true });

    expect(scanExecutor.ctor).not.toHaveBeenCalled();
  });
});

describe('getConfig', () => {
  it('should map the qoq.config justifyDisable block into modules.justifyDisable', async () => {
    cosmiconfigSearch.mockResolvedValue({
      config: { justifyDisable: { severity: 'error' } },
      filepath: 'qoq.config.js',
    });

    const modulesConfig = await getConfig(dummyModulesConfig.workspaces, true);

    expect(modulesConfig.modules.justifyDisable).toStrictEqual({ severity: 'error' });
  });
});
