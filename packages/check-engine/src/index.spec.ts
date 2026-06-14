import { existsSync, readdirSync } from 'node:fs';

import { getPackageJson, resolveCwdPath } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkEngine } from './helpers/checkEngine.ts';
import { fetchNodeInfo } from './helpers/fetchNodeInfo.ts';
import { cli } from './index.ts';

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

const makeEntry = (parentPath: string, name: string): unknown => ({
  parentPath,
  name,
  isDirectory: (): boolean => true,
});

const run = async (...argv: string[]): Promise<void> => {
  cli.parse(['node', 'check-engine', ...argv], { run: false });

  await cli.runMatchedCommand();
};

describe('cli', () => {
  beforeEach(() => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.mocked(fetchNodeInfo).mockResolvedValue({ currentLts: 'v22.1.0', maintainedLts: 'v20.1.0' });
    vi.mocked(getPackageJson).mockReturnValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
    cli.unsetMatchedCommand();
  });

  it('should register the default command', () => {
    expect(cli.commands.map((command) => command.name)).toContain('');
  });

  it('should check only the root package.json when there are no workspaces', async () => {
    await run();

    expect(fetchNodeInfo).toHaveBeenCalledWith('./node.json');
    expect(checkEngine).toHaveBeenCalledTimes(1);
    expect(checkEngine).toHaveBeenCalledWith('./package.json', false);
  });

  it('should include literal workspace paths verbatim', async () => {
    vi.mocked(getPackageJson).mockReturnValue({ workspaces: ['libs/foo'] });

    await run();

    expect(checkEngine).toHaveBeenCalledTimes(2);
    expect(checkEngine).toHaveBeenNthCalledWith(1, './package.json', true);
    expect(checkEngine).toHaveBeenNthCalledWith(2, 'libs/foo', true);
  });

  it('should expand glob workspaces to each child package.json that exists', async () => {
    vi.mocked(getPackageJson).mockReturnValue({ workspaces: ['packages/*'] });
    vi.mocked(readdirSync).mockReturnValue([
      makeEntry('packages', 'a'),
      makeEntry('packages', 'b'),
    ] as never);
    vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false);

    await run();

    expect(resolveCwdPath).toHaveBeenCalledWith('/packages/');
    expect(checkEngine).toHaveBeenCalledTimes(2);
    expect(checkEngine).toHaveBeenCalledWith('./package.json', true);
    expect(checkEngine).toHaveBeenCalledWith('packages/a/package.json', true);
    expect(checkEngine).not.toHaveBeenCalledWith('packages/b/package.json', true);
  });

  it('should report the resolved LTS versions on stderr', async () => {
    const stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await run();

    expect(stderrMock).toHaveBeenCalledWith(expect.stringContaining('CHECK ENGINE'));
    expect(stderrMock).toHaveBeenCalledWith(expect.stringContaining('v22.1.0'));
    expect(stderrMock).toHaveBeenCalledWith(expect.stringContaining('v20.1.0'));
  });
});
