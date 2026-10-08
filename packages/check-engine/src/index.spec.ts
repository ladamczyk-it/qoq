import { existsSync, readdirSync } from 'node:fs';

import { getPackageJson, resolveCwdPath } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkEngine } from './helpers/checkEngine.ts';
import { fetchNodeInfo } from './helpers/fetchNodeInfo.ts';
import { formatHuman } from './helpers/report.ts';
import { cli } from './index.ts';

import type { WorkspaceResult } from './helpers/types.ts';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

vi.mock('@ladamczyk/qoq-utils', () => ({
  getPackageJson: vi.fn(),
  getRelativePath: vi.fn((path: string) => path),
  resolveCwdPath: vi.fn((path: string) => path),
}));

vi.mock('./helpers/checkEngine.ts', () => ({ checkEngine: vi.fn() }));
vi.mock('./helpers/fetchNodeInfo.ts', () => ({ fetchNodeInfo: vi.fn() }));
vi.mock('./helpers/report.ts', () => ({ formatHuman: vi.fn() }));

const makeEntry = (parentPath: string, name: string): unknown => ({
  parentPath,
  name,
  isDirectory: (): boolean => true,
});

const makeResult = (status: 'pass' | 'fail'): WorkspaceResult =>
  ({ status }) as unknown as WorkspaceResult;

const run = async (...argv: string[]): Promise<void> => {
  cli.parse(['node', 'check-engine', ...argv], { run: false });

  await cli.runMatchedCommand();
};

describe('cli', () => {
  let stderrMock: ReturnType<typeof vi.spyOn>;
  let exitMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitMock = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    vi.mocked(checkEngine).mockReturnValue(makeResult('pass'));
    vi.mocked(formatHuman).mockReturnValue('REPORT');
    vi.mocked(getPackageJson).mockReturnValue({});
  });

  afterEach(() => {
    process.exitCode = undefined;
    vi.clearAllMocks();
    cli.unsetMatchedCommand();
  });

  it('should register the default command', () => {
    expect(cli.commands.map((command) => command.name)).toContain('');
  });

  it('should check only the root package.json when there are no workspaces', async () => {
    await run();

    expect(checkEngine).toHaveBeenCalledTimes(1);
    expect(checkEngine).toHaveBeenCalledWith('./package.json');
  });

  it('should check root, literal workspace and glob match in order', async () => {
    vi.mocked(getPackageJson).mockReturnValue({ workspaces: ['libs/foo', 'packages/*'] });
    vi.mocked(readdirSync).mockReturnValue([
      makeEntry('packages', 'a'),
      makeEntry('packages', 'b'),
    ] as never);
    vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false);

    await run();

    expect(resolveCwdPath).toHaveBeenCalledWith('/packages/');
    expect(checkEngine).toHaveBeenCalledTimes(3);
    expect(checkEngine).toHaveBeenNthCalledWith(1, './package.json');
    expect(checkEngine).toHaveBeenNthCalledWith(2, 'libs/foo');
    expect(checkEngine).toHaveBeenNthCalledWith(3, 'packages/a/package.json');
  });

  it('should pass every result to formatHuman and set exitCode 1 when any fail', async () => {
    vi.mocked(getPackageJson).mockReturnValue({ workspaces: ['libs/foo', 'libs/bar'] });
    const first = makeResult('fail');
    const second = makeResult('pass');
    const third = makeResult('fail');
    const results = [first, second, third];
    vi.mocked(checkEngine)
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
      .mockReturnValueOnce(third);

    await run();

    expect(formatHuman).toHaveBeenCalledWith(results);
    expect(process.exitCode).toBe(1);
  });

  it('should leave exitCode unset when all results pass', async () => {
    await run();

    expect(process.exitCode).toBeUndefined();
  });

  it('should write exactly the formatHuman output to stderr', async () => {
    await run();

    expect(stderrMock).toHaveBeenCalledTimes(1);
    expect(stderrMock).toHaveBeenCalledWith('REPORT');
  });

  it('should never call process.exit or fetchNodeInfo', async () => {
    vi.mocked(checkEngine).mockReturnValue(makeResult('fail'));

    await run();

    expect(exitMock).not.toHaveBeenCalled();
    expect(fetchNodeInfo).not.toHaveBeenCalled();
  });
});
