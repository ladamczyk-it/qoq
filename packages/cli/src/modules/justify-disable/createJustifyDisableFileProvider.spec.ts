import { describe, it, expect, vi } from 'vitest';

import { IModulesConfig } from '../types.ts';

import { createJustifyDisableFileProvider } from './createJustifyDisableFileProvider.ts';

import type { TFileProvider } from '@ladamczyk/justify-disable';

const extensions = {
  ts: ['eslint'],
  js: ['eslint'],
  mjs: ['eslint'],
  vue: ['eslint', 'stylelint'],
  scss: ['stylelint'],
  md: [],
};

const run = async (
  modules: IModulesConfig['modules'],
  gitPaths: string[],
  paths: string[] = [],
  srcPath = './src'
) => {
  const listRepositoryFiles = vi.fn<TFileProvider>(() => gitPaths.map((path) => ({ path })));
  const provider = createJustifyDisableFileProvider(
    { srcPath, modules },
    { listRepositoryFiles, extensions }
  );

  return { result: await provider({ paths }), listRepositoryFiles };
};

describe('createJustifyDisableFileProvider', () => {
  it('returns only files matching the eslint entry', async () => {
    const { result } = await run({ eslint: [{ files: ['src/**/*.ts'] }] }, [
      'src/a.ts',
      'lib/b.ts',
    ]);

    expect(result).toStrictEqual([{ path: 'src/a.ts', tools: ['eslint'] }]);
  });

  it('drops files matched by ignores', async () => {
    const { result } = await run(
      { eslint: [{ files: ['src/**/*.ts'], ignores: ['**/*.spec.ts'] }] },
      ['src/a.spec.ts', 'src/a.ts']
    );

    expect(result.map((f) => f.path)).toStrictEqual(['src/a.ts']);
  });

  it('un-ignores a path with a later negated pattern', async () => {
    const { result } = await run(
      { eslint: [{ files: ['src/**/*.ts'], ignores: ['**/*.spec.ts', '!src/keep.spec.ts'] }] },
      ['src/keep.spec.ts', 'src/other.spec.ts']
    );

    expect(result).toStrictEqual([{ path: 'src/keep.spec.ts', tools: ['eslint'] }]);
  });

  it('requires every pattern of a nested files array to match', async () => {
    const { result } = await run({ eslint: [{ files: [['src/**', '**/*.ts']] }] }, [
      'src/a.ts',
      'src/a.js',
    ]);

    expect(result.map((f) => f.path)).toStrictEqual(['src/a.ts']);
  });

  it('uses ESLint default files when the entry has none', async () => {
    const { result } = await run({ eslint: [{}] }, ['x/y.mjs', 'x/y.ts']);

    expect(result.map((f) => f.path)).toStrictEqual(['x/y.mjs']);
  });

  it('returns nothing without eslint and stylelint blocks', async () => {
    const { result } = await run({}, ['src/a.ts', 'src/a.scss']);

    expect(result).toStrictEqual([]);
  });

  it('skips files whose extension has no eslint tool', async () => {
    const { result } = await run({ eslint: [{ files: ['src/**'] }] }, [
      'src/readme.md',
      'src/a.ts',
    ]);

    expect(result.map((f) => f.path)).toStrictEqual(['src/a.ts']);
  });

  it('adds stylelint for files inside the srcPath glob', async () => {
    const { result } = await run({ stylelint: { template: 'qoq-stylelint-scss' } }, [
      'src/a.scss',
      'lib/a.scss',
    ]);

    expect(result).toStrictEqual([{ path: 'src/a.scss', tools: ['stylelint'] }]);
  });

  it('gives a file matching both tools both', async () => {
    const { result } = await run(
      { eslint: [{ files: ['**/*.vue'] }], stylelint: { pattern: '**/*.vue' } },
      ['src/a.vue']
    );

    expect(result).toStrictEqual([{ path: 'src/a.vue', tools: ['eslint', 'stylelint'] }]);
  });

  it('uses ctx.paths directly without listing the repository', async () => {
    const { result, listRepositoryFiles } = await run(
      { eslint: [{ files: ['src/**/*.ts'] }] },
      [],
      ['src/a.ts', 'b.css']
    );

    expect(result).toStrictEqual([{ path: 'src/a.ts', tools: ['eslint'] }]);
    expect(listRepositoryFiles).not.toHaveBeenCalled();
  });

  it('lists the repository once when ctx.paths is empty', async () => {
    const { listRepositoryFiles } = await run({}, []);

    expect(listRepositoryFiles).toHaveBeenCalledExactlyOnceWith({ paths: [] });
  });
});
