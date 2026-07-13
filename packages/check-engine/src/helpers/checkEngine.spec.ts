import { getPackageInfo } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { checkEngine } from './checkEngine.ts';
import { readJsonSync } from './readJson.ts';

import type { PackageJson } from 'type-fest';

vi.mock('./readJson.ts', () => ({
  readJsonSync: vi.fn(),
}));

vi.mock('@ladamczyk/qoq-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ladamczyk/qoq-utils')>()),
  getPackageInfo: vi.fn(),
}));

const mockPackageJson = (pkg: PackageJson): void => {
  vi.mocked(readJsonSync).mockReturnValue(pkg);
};

const mockDependencyEngine = (node: string | undefined): void => {
  vi.mocked(getPackageInfo).mockReturnValue({
    packageJson: { engines: node ? { node } : undefined },
  } as unknown as ReturnType<typeof getPackageInfo>);
};

// Mirrors a real `process.exit`: it halts the function rather than letting
// execution fall through past the exit call.
class ProcessExitError extends Error {}

describe('checkEngine', () => {
  let stderr: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += String(chunk);

      return true;
    });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new ProcessExitError();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports the configured engines.node and accepts a range that intersects the dependencies', () => {
    mockPackageJson({ engines: { node: '>=20' }, dependencies: { dep: '1.0.0' } });
    mockDependencyEngine('>=18');

    checkEngine('./package.json');

    expect(stderr).toContain('Found engines.node config:');
    expect(stderr).toContain('Configured correctly!');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits with code 1 when the configured range cannot satisfy a dependency', () => {
    mockPackageJson({ engines: { node: '>=20' }, dependencies: { dep: '1.0.0' } });
    mockDependencyEngine('<10');

    expect(() => checkEngine('./package.json')).toThrow(ProcessExitError);

    expect(stderr).toContain('does not match dependencies criteria');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('accepts an exact version that satisfies the dependency range', () => {
    mockPackageJson({ engines: { node: '20.1.0' }, dependencies: { dep: '1.0.0' } });
    mockDependencyEngine('>=18');

    checkEngine('./package.json');

    expect(stderr).toContain('Configured correctly!');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits with code 1 when an exact version does not satisfy the dependency range', () => {
    mockPackageJson({ engines: { node: '16.0.0' }, dependencies: { dep: '1.0.0' } });
    mockDependencyEngine('>=18');

    expect(() => checkEngine('./package.json')).toThrow(ProcessExitError);

    expect(stderr).toContain('does not match dependencies criteria');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when engines.node is neither a valid version nor range', () => {
    mockPackageJson({ engines: { node: 'not-a-version' }, dependencies: { dep: '1.0.0' } });
    mockDependencyEngine('>=18');

    expect(() => checkEngine('./package.json')).toThrow(ProcessExitError);

    expect(stderr).toContain('Bad engines.node version!');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('falls back to devDependencies when there are no dependencies', () => {
    mockPackageJson({ engines: { node: '>=20' }, devDependencies: { dep: '1.0.0' } });
    mockDependencyEngine('>=18');

    checkEngine('./package.json');

    expect(stderr).toContain('No dependencies found, checking engines also from devDependencies.');
    expect(stderr).toContain('Configured correctly!');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('warns when no engines.node is configured instead of exiting', () => {
    mockPackageJson({ dependencies: {} });
    mockDependencyEngine(undefined);

    checkEngine('./package.json');

    expect(stderr).toContain('No engines.node configured');
    expect(stderr).toContain('set engines based only on Your project.');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prints the path header when run across workspaces', () => {
    mockPackageJson({ engines: { node: '>=20' }, dependencies: { dep: '1.0.0' } });
    mockDependencyEngine('>=18');

    checkEngine('packages/demo/package.json', true);

    expect(stderr).toContain("Checking 'packages/demo/package.json':");
  });
});
