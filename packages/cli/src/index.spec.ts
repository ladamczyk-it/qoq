import { mkdirSync } from 'fs';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { camelFlags, cli } from './index.ts';
import { execute, getConfig, initConfig, scan } from './modules/index.ts';

vi.mock('@npmcli/package-json/lib/read-package', () => ({
  readPackage: vi.fn().mockResolvedValue({ workspaces: ['packages/*'] }),
}));

vi.mock('./helpers/paths.ts', () => ({
  resolveCliRelativePath: (path: string): string => `./resolved${path}`,
  toPosix: (path: string): string => path.replaceAll('\\', '/'),
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
  scan: vi.fn(),
}));

const run = async (...argv: string[]): Promise<void> => {
  cli.parse(camelFlags(['node', 'qoq', ...argv]), { run: false });

  await cli.runMatchedCommand();
};

describe('cli', () => {
  beforeEach(() => {
    // GitHub Actions sets CI=true, which flips getConfig/silent defaults.
    vi.stubEnv('CI', undefined);
    vi.mocked(getConfig).mockResolvedValue(dummyConfig as never);
    vi.mocked(execute).mockResolvedValue(undefined);
    vi.mocked(scan).mockResolvedValue(undefined);
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
    expect(names).toContain('scan');
  });

  describe('default command', () => {
    it('should load the config and run every tool when no flags are passed', async () => {
      await run();

      expect(getConfig).toHaveBeenCalledWith(['packages/*'], false);
      expect(execute).toHaveBeenCalledWith(
        dummyConfig,
        expect.objectContaining({ fix: false, disableCache: false, concurrency: 'off' }),
        undefined,
        undefined
      );
    });

    it('should skip the setup wizard when --warmup is passed', async () => {
      await run('--warmup');

      expect(getConfig).toHaveBeenCalledWith(['packages/*'], true);
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
      await run(
        '--skip-npm',
        '--skip-eslint',
        '--skip-stylelint',
        '--skip-skillslint',
        '--skip-justify-disable'
      );

      expect(execute).toHaveBeenCalledWith(
        dummyConfig,
        expect.objectContaining({
          skipNpm: true,
          skipEslint: true,
          skipStylelint: true,
          skipSkillslint: true,
          skipJustifyDisable: true,
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

    it('should skip the setup wizard when CI=true', async () => {
      vi.stubEnv('CI', 'true');

      await run();

      expect(getConfig).toHaveBeenCalledWith(['packages/*'], true);
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

    it('should say there is nothing to check and run no tool when no files are given', async () => {
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await run('staged');

      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('No files given'));
      expect(getConfig).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();

      stdoutWrite.mockRestore();
    });

    it('should keep the first file when a boolean flag precedes the list', async () => {
      await run('staged', '--skip-knip', '--skip-justify-disable', 'src/a.ts', 'src/b.ts');

      expect(execute).toHaveBeenCalledWith(
        dummyConfig,
        expect.objectContaining({ skipKnip: true, skipJustifyDisable: true }),
        ['src/a.ts', 'src/b.ts']
      );
    });

    it('should turn absolute paths into cwd-relative ones', async () => {
      await run('staged', join(process.cwd(), 'src', 'a.ts'));

      expect(execute).toHaveBeenCalledWith(dummyConfig, expect.anything(), ['src/a.ts']);
    });

    it('should create the --output directory under --json', async () => {
      await run('staged', '--json', '--output', 'out/nested', 'src/a.ts');

      expect(mkdirSync).toHaveBeenCalledWith('out/nested', { recursive: true });
    });

    it('should treat CI=true as --silent', async () => {
      const original = process.env.CI;

      process.env.CI = 'true';

      await run('staged', 'src/a.ts');

      expect(execute).toHaveBeenCalledWith(dummyConfig, expect.objectContaining({ silent: true }), [
        'src/a.ts',
      ]);

      process.env.CI = original;
    });
  });

  describe('scan command', () => {
    it('should load the config without the wizard and call scan, never execute', async () => {
      await run('scan');

      expect(getConfig).toHaveBeenCalledWith(undefined, true);
      expect(scan).toHaveBeenCalledOnce();
      expect(execute).not.toHaveBeenCalled();
    });

    it('should pass --timeout as a number and --production and --graph in the options', async () => {
      await run('scan', '--timeout', '3000', '--production', '--graph');

      expect(scan).toHaveBeenCalledWith(
        dummyConfig,
        expect.objectContaining({ production: true, graph: true }),
        3000
      );
    });

    it('should create the --output directory recursively under --json', async () => {
      await run('scan', '--json', '--output', 'out/nested');

      expect(mkdirSync).toHaveBeenCalledWith('out/nested', { recursive: true });
    });

    it('should not create a directory without --json', async () => {
      await run('scan');

      expect(mkdirSync).not.toHaveBeenCalled();
    });

    it('should not imply silent from CI=true', async () => {
      vi.stubEnv('CI', 'true');

      await run('scan');

      expect(scan).toHaveBeenCalledWith(
        dummyConfig,
        expect.objectContaining({ silent: false }),
        undefined
      );
    });

    it('should not be called by the default or staged commands', async () => {
      await run('--check');
      await run('staged', 'a.ts');

      expect(scan).not.toHaveBeenCalled();
    });
  });
});
