import { getPackageInfo } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

type TEngines = Record<string, string | undefined>;

const mockWorkspace = (pkg: PackageJson, installed: TEngines | null = {}): void => {
  vi.mocked(readJsonSync).mockReturnValue(pkg);
  vi.mocked(getPackageInfo).mockImplementation(((name: string) => {
    if (installed === null || !(name in installed)) {
      throw new Error(`Package ${name} not installed!`);
    }

    const node = installed[name];

    return { packageJson: { engines: node ? { node } : undefined } };
  }) as unknown as typeof getPackageInfo);
};

const withDeps = (node: string | undefined, deps: TEngines): void => {
  mockWorkspace(
    {
      ...(node === undefined ? {} : { engines: { node } }),
      dependencies: Object.fromEntries(Object.keys(deps).map((name) => [name, '1.0.0'])),
    },
    deps
  );
};

describe('checkEngine', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails a ranged engines.node whose range is not a subset of the dependency range', () => {
    withDeps('>=18', { dep: '>=22' });

    const result = checkEngine('./package.json');

    expect(result.status).toBe('fail');
    expect(result).toMatchObject({
      reason: 'incompatible',
      conflicts: [
        { dependency: 'dep', range: '>=22', why: 'not-subset', dependencyFloor: '22.0.0' },
      ],
    });
  });

  it('fails when engines.node admits versions the dependency excludes', () => {
    withDeps('>=22.22.2', { dep: '^22.13.0 || ^24.0.0' });

    expect(checkEngine('./package.json').status).toBe('fail');
  });

  it('passes the repo-style multi-range engines.node', () => {
    withDeps('^22.22.2 || ^24.15.0 || >=26.0.0', {
      a: '^22.12.0 || ^24.0.0 || >=26.0.0',
      b: '^20.19.0 || ^22.13.0 || >=24',
    });

    expect(checkEngine('./package.json').status).toBe('pass');
  });

  it('documents the semver.subset ceiling: >=22 vs ^22 || >=23 reports not-subset', () => {
    withDeps('>=22', { dep: '^22 || >=23' });

    expect(checkEngine('./package.json')).toMatchObject({
      status: 'fail',
      reason: 'incompatible',
    });
  });

  it('tests an exact engines.node against the dependency range', () => {
    withDeps('22.22.2', { dep: '^22.13.0 || ^24' });

    expect(checkEngine('./package.json').status).toBe('pass');

    withDeps('22.22.2', { dep: '>=24' });

    expect(checkEngine('./package.json')).toMatchObject({
      status: 'fail',
      reason: 'incompatible',
      conflicts: [{ why: 'not-in-range' }],
    });
  });

  it('lists every failing dependency in conflicts', () => {
    withDeps('>=18', { a: '>=22', b: '>=20' });

    expect(checkEngine('./package.json')).toMatchObject({
      status: 'fail',
      conflicts: [
        { dependency: 'a', range: '>=22' },
        { dependency: 'b', range: '>=20' },
      ],
    });
  });

  it('reports mutually unsatisfiable ranges with a null floor and a conflict per dependency', () => {
    withDeps('>=22', { a: '>=22', b: '<20' });

    const result = checkEngine('./package.json');

    expect(result.floor).toBeNull();
    expect(result).toMatchObject({
      status: 'fail',
      reason: 'incompatible',
      conflicts: [{ dependency: 'a' }, { dependency: 'b' }],
    });
  });

  it('computes the required floor across all dependency ranges', () => {
    withDeps(undefined, {
      a: '>=22.12.0',
      b: '^20.19.0 || ^22.13.0 || >=24',
      c: '>=22.22.2',
    });

    expect(checkEngine('./package.json').floor).toBe('22.22.2');
  });

  it('fails an invalid engines.node', () => {
    withDeps('banana', { dep: '>=22' });

    const result = checkEngine('./package.json');

    expect(result).toMatchObject({
      status: 'fail',
      reason: 'invalid-engines',
      configured: 'banana',
    });
    expect('message' in result && result.message.length > 0).toBe(true);
  });

  it('passes with null configured and configuredFloor when engines.node is absent', () => {
    withDeps(undefined, { dep: '>=22' });

    expect(checkEngine('./package.json')).toMatchObject({
      status: 'pass',
      configured: null,
      configuredFloor: null,
    });
  });

  it('skips uninstalled, engine-less and malformed dependencies without failing', () => {
    mockWorkspace(
      {
        engines: { node: '>=22' },
        dependencies: { ok: '1', missing: '1', plain: '1', weird: '1' },
      },
      { ok: '>=20', plain: undefined, weird: 'not a range' }
    );

    const result = checkEngine('./package.json');

    expect(result.status).toBe('pass');
    expect(result.skipped).toStrictEqual([
      { name: 'missing', group: 'dependencies', reason: 'not-installed', range: null },
      { name: 'plain', group: 'dependencies', reason: 'no-engines', range: null },
      { name: 'weird', group: 'dependencies', reason: 'malformed-range', range: 'not a range' },
    ]);
    expect(result.counts).toStrictEqual({ checked: 1, skipped: 3 });
  });

  it('falls back to devDependencies only when there are no dependencies', () => {
    mockWorkspace({ devDependencies: { dev: '1' } }, { dev: '>=22' });

    expect(checkEngine('./package.json').requirements).toStrictEqual([
      { name: 'dev', group: 'devDependencies', range: '>=22' },
    ]);
  });

  it('carries the devDependencies group onto skipped and conflict entries from the fallback', () => {
    mockWorkspace(
      { engines: { node: '>=18' }, devDependencies: { gone: '1', dev: '1' } },
      { dev: '>=22' }
    );

    const result = checkEngine('./package.json');

    expect(result.skipped[0]?.group).toBe('devDependencies');
    expect(result).toMatchObject({ conflicts: [{ dependency: 'dev', group: 'devDependencies' }] });
  });

  it('ignores devDependencies when dependencies are present and reports a shared name once', () => {
    mockWorkspace(
      { dependencies: { shared: '1' }, devDependencies: { shared: '1', dev: '1' } },
      { shared: '>=22', dev: '>=24' }
    );

    expect(checkEngine('./package.json').requirements).toStrictEqual([
      { name: 'shared', group: 'dependencies', range: '>=22' },
    ]);
  });

  it('returns unreadable with the path in the message when package.json cannot be read', () => {
    vi.mocked(readJsonSync).mockImplementation(() => {
      throw new Error('Could not read file: ./nope/package.json');
    });

    expect(checkEngine('./nope/package.json')).toMatchObject({
      status: 'fail',
      reason: 'unreadable',
      message: expect.stringContaining('./nope/package.json'),
    });
  });

  it('never calls process.exit or writes to stderr, on pass, fail or unreadable', () => {
    withDeps('>=22', { dep: '>=22' });
    checkEngine('./package.json');
    withDeps('banana', { dep: '>=22' });
    checkEngine('./package.json');
    withDeps('>=18', { dep: '>=22' });
    checkEngine('./package.json');
    vi.mocked(readJsonSync).mockImplementation(() => {
      throw new Error('Could not read file: x');
    });
    checkEngine('./x/package.json');

    expect(exitSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
