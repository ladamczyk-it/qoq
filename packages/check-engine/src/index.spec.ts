import { getPackageJson } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkEngine } from './helpers/checkEngine.ts';
import { fetchNodeInfo } from './helpers/fetchNodeInfo.ts';
import { findWorkspaces } from './helpers/findWorkspaces.ts';
import { formatHuman } from './helpers/report.ts';
import { cli } from './index.ts';

import type { WorkspaceResult } from './helpers/types.ts';

vi.mock('@ladamczyk/qoq-utils', () => ({
  getPackageJson: vi.fn(),
}));

vi.mock('./helpers/checkEngine.ts', () => ({ checkEngine: vi.fn() }));
vi.mock('./helpers/fetchNodeInfo.ts', () => ({ fetchNodeInfo: vi.fn() }));
vi.mock('./helpers/findWorkspaces.ts', () => ({ findWorkspaces: vi.fn() }));
vi.mock('./helpers/report.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./helpers/report.ts')>()),
  formatHuman: vi.fn(),
}));

const lts = { currentLts: 'v24.13.0', maintainedLts: 'v22.13.1' };
const noInclude = { include: [], lts };

const makeResult = (status: 'pass' | 'fail'): WorkspaceResult =>
  ({ status }) as unknown as WorkspaceResult;

const run = async (...argv: string[]): Promise<void> => {
  cli.parse(['node', 'check-engine', ...argv], { run: false });

  await cli.runMatchedCommand();
};

describe('cli', () => {
  let stderrMock: ReturnType<typeof vi.spyOn>;
  let stdoutMock: ReturnType<typeof vi.spyOn>;
  let exitMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stdoutMock = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitMock = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    vi.mocked(checkEngine).mockReturnValue(makeResult('pass'));
    vi.mocked(formatHuman).mockReturnValue('REPORT');
    vi.mocked(getPackageJson).mockReturnValue({});
    vi.mocked(fetchNodeInfo).mockResolvedValue(lts);
    vi.mocked(findWorkspaces).mockReturnValue(['./package.json']);
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
    expect(checkEngine).toHaveBeenCalledWith('./package.json', noInclude);
  });

  it('should pass the root workspaces value to findWorkspaces and check each returned path', async () => {
    const workspaces = ['libs/foo', 'packages/*'];
    vi.mocked(getPackageJson).mockReturnValue({ workspaces });
    vi.mocked(findWorkspaces).mockReturnValue([
      './package.json',
      'libs/foo/package.json',
      'packages/a/package.json',
    ]);

    await run();

    expect(findWorkspaces).toHaveBeenCalledWith(process.cwd(), workspaces);
    expect(checkEngine).toHaveBeenCalledTimes(3);
    expect(checkEngine).toHaveBeenNthCalledWith(1, './package.json', noInclude);
    expect(checkEngine).toHaveBeenNthCalledWith(2, 'libs/foo/package.json', noInclude);
    expect(checkEngine).toHaveBeenNthCalledWith(3, 'packages/a/package.json', noInclude);
  });

  it('should pass every result to formatHuman and set exitCode 1 when any fail', async () => {
    vi.mocked(findWorkspaces).mockReturnValue([
      './package.json',
      'a/package.json',
      'b/package.json',
    ]);
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

  it('should never call process.exit', async () => {
    vi.mocked(checkEngine).mockReturnValue(makeResult('fail'));

    await run();

    expect(exitMock).not.toHaveBeenCalled();
  });

  it('should fetch the LTS info once and pass it to every checkEngine call', async () => {
    vi.mocked(findWorkspaces).mockReturnValue(['./package.json', 'a/package.json']);

    await run();

    expect(fetchNodeInfo).toHaveBeenCalledTimes(1);
    expect(fetchNodeInfo).toHaveBeenCalledWith('./node.json');
    expect(checkEngine).toHaveBeenNthCalledWith(1, './package.json', { include: [], lts });
    expect(checkEngine).toHaveBeenNthCalledWith(2, 'a/package.json', { include: [], lts });
  });

  it('should skip the LTS lookup and pass lts null with --no-lts', async () => {
    await run('--no-lts');

    expect(fetchNodeInfo).not.toHaveBeenCalled();
    expect(checkEngine).toHaveBeenCalledWith('./package.json', { include: [], lts: null });
  });

  it('should reject with the fetchNodeInfo error and not call checkEngine', async () => {
    vi.mocked(fetchNodeInfo).mockRejectedValue(new Error('no lts data'));

    await expect(run()).rejects.toThrow('no lts data');
    expect(checkEngine).not.toHaveBeenCalled();
  });

  it('should call checkEngine with the parsed include list for every workspace', async () => {
    vi.mocked(findWorkspaces).mockReturnValue(['./package.json', 'a/package.json']);

    await run('--include', 'dev,peer');

    const options = { include: ['dev', 'peer'], lts };

    expect(checkEngine).toHaveBeenCalledTimes(2);
    expect(checkEngine).toHaveBeenNthCalledWith(1, './package.json', options);
    expect(checkEngine).toHaveBeenNthCalledWith(2, 'a/package.json', options);
  });

  it('should write the JSON document to stdout and the human text to stderr with --json', async () => {
    await run('--json');

    expect(stdoutMock).toHaveBeenCalledTimes(1);
    const written = stdoutMock.mock.calls[0]?.[0] as string;

    expect(written.endsWith('\n')).toBe(true);
    const document = JSON.parse(written) as Record<string, unknown>;

    expect(document).toHaveProperty('ok', true);
    expect(document).toHaveProperty('lts', lts);
    expect(document).toHaveProperty('workspaces');
    expect(stderrMock).toHaveBeenCalledWith('REPORT');
  });

  it('should still write the document and nothing to stderr with --json --quiet on a passing run', async () => {
    vi.mocked(formatHuman).mockReturnValue('');

    await run('--json', '--quiet');

    expect(formatHuman).toHaveBeenCalledWith([makeResult('pass')], { quiet: true });
    expect(stdoutMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stdoutMock.mock.calls[0]?.[0] as string)).toHaveProperty('workspaces');
    expect(stderrMock).not.toHaveBeenCalled();
  });

  it('should write nothing to stdout without --json', async () => {
    await run();

    expect(stdoutMock).not.toHaveBeenCalled();
  });

  it('should reject an unknown include value without running anything', async () => {
    await run('--include', 'banana');

    expect(stderrMock).toHaveBeenCalledTimes(1);
    expect(stderrMock.mock.calls[0]?.[0]).toMatch(/^[^\n]*banana[^\n]*\n?$/);
    expect(process.exitCode).toBe(1);
    expect(checkEngine).not.toHaveBeenCalled();
  });
});
