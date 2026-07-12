import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cli } from './index.ts';
import { execute, getConfig, initConfig } from './modules/index.ts';

vi.mock('@npmcli/package-json/lib/read-package', () => ({
  readPackage: vi.fn().mockResolvedValue({ workspaces: ['packages/*'] }),
}));

vi.mock('./helpers/paths.ts', () => ({
  resolveCliRelativePath: (path: string): string => `./resolved${path}`,
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}));

const dummyConfig = { srcPath: '', configType: 'esm', modules: {}, configPaths: {} };

vi.mock('./modules/index.ts', () => ({
  getConfig: vi.fn(),
  initConfig: vi.fn(),
  execute: vi.fn(),
}));

const run = async (...argv: string[]): Promise<void> => {
  cli.parse(['node', 'qoq', ...argv], { run: false });

  await cli.runMatchedCommand();
};

describe('cli', () => {
  beforeEach(() => {
    vi.mocked(getConfig).mockResolvedValue(dummyConfig as never);
    vi.mocked(execute).mockResolvedValue(undefined);
    vi.mocked(initConfig).mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    cli.unsetMatchedCommand();
  });

  it('should register the default and staged commands', () => {
    const names = cli.commands.map((command) => command.name);

    // cac exposes the catch-all default command under an empty name.
    expect(names).toContain('');
    expect(names).toContain('staged');
  });

  describe('default command', () => {
    it('should load the config and run every tool when no flags are passed', async () => {
      await run();

      expect(getConfig).toHaveBeenCalledWith(['packages/*']);
      expect(execute).toHaveBeenCalledWith(
        dummyConfig,
        expect.objectContaining({ fix: false, disableCache: false, concurrency: 'off' }),
        undefined,
        undefined
      );
    });

    it('should scaffold a config and skip execution when --init is passed', async () => {
      await run('--init');

      expect(initConfig).toHaveBeenCalledWith(['packages/*']);
      expect(getConfig).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    });

    it('should forward positional tool names to execute', async () => {
      await run('eslint', 'prettier');

      expect(execute).toHaveBeenCalledWith(dummyConfig, expect.anything(), undefined, [
        'eslint',
        'prettier',
      ]);
    });

    it('should map --fix and --disable-cache flags onto the executor options', async () => {
      await run('--fix', '--disable-cache');

      expect(execute).toHaveBeenCalledWith(
        dummyConfig,
        expect.objectContaining({ fix: true, disableCache: true }),
        undefined,
        undefined
      );
    });

    it('should forward skip flags to execute', async () => {
      await run('--skip-npm', '--skip-eslint', '--skip-stylelint', '--skip-skillslint');

      expect(execute).toHaveBeenCalledWith(
        dummyConfig,
        expect.objectContaining({
          skipNpm: true,
          skipEslint: true,
          skipStylelint: true,
          skipSkillslint: true,
        }),
        undefined,
        undefined
      );
    });

    it('should honor an explicit --concurrency value', async () => {
      await run('--concurrency', 'auto');

      expect(execute).toHaveBeenCalledWith(
        dummyConfig,
        expect.objectContaining({ concurrency: 'auto' }),
        undefined,
        undefined
      );
    });

    it('should not force silent when CI is unset', async () => {
      vi.stubEnv('CI', undefined);

      await run();

      expect(execute).toHaveBeenCalledWith(
        dummyConfig,
        expect.objectContaining({ silent: false }),
        undefined,
        undefined
      );
    });

    it('should treat CI=true as --silent', async () => {
      vi.stubEnv('CI', 'true');

      await run();

      expect(execute).toHaveBeenCalledWith(
        dummyConfig,
        expect.objectContaining({ silent: true }),
        undefined,
        undefined
      );
    });
  });

  describe('staged command', () => {
    it('should read the staged config and forward the file list to execute', async () => {
      await run('staged', 'src/a.ts', 'src/b.ts');

      expect(getConfig).toHaveBeenCalledWith(['packages/*'], true);
      expect(execute).toHaveBeenCalledWith(
        dummyConfig,
        expect.objectContaining({ fix: false, disableCache: false, concurrency: 'off' }),
        ['src/a.ts', 'src/b.ts']
      );
    });

    it('should pass an empty file list when no files are given', async () => {
      await run('staged');

      expect(execute).toHaveBeenCalledWith(dummyConfig, expect.anything(), []);
    });

    it('should treat CI=true as --silent', async () => {
      const original = process.env.CI;

      process.env.CI = 'true';

      await run('staged');

      expect(execute).toHaveBeenCalledWith(
        dummyConfig,
        expect.objectContaining({ silent: true }),
        []
      );

      process.env.CI = original;
    });
  });
});
