import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { readDependencies } from './readDependencies.ts';

const REG = 'https://registry.npmjs.org/';
const pub = (name: string, version = '1.0.0', extra = {}) => ({
  version,
  resolved: `${REG}${name}/-/x-${version}.tgz`,
  ...extra,
});

describe('readDependencies', () => {
  let dir = '';

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const lock = (content: unknown): string => {
    dir = mkdtempSync(join(tmpdir(), 'qoq-scan-'));
    const path = join(dir, 'package-lock.json');
    writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
    return path;
  };
  const v3 = (packages: Record<string, unknown>) => lock({ lockfileVersion: 3, packages });

  it('reports a missing lockfile', () => {
    expect(readDependencies(join(tmpdir(), 'qoq-nope', 'package-lock.json'), false)).toStrictEqual({
      ok: false,
      reason: 'no package-lock.json',
    });
  });

  it('reports invalid JSON without throwing', () => {
    expect(readDependencies(lock('{ nope'), false)).toStrictEqual({
      ok: false,
      reason: 'unsupported package-lock.json (lockfileVersion unknown)',
    });
  });

  it('rejects lockfileVersion 1', () => {
    expect(readDependencies(lock({ lockfileVersion: 1, dependencies: {} }), false)).toStrictEqual({
      ok: false,
      reason: 'unsupported package-lock.json (lockfileVersion 1)',
    });
  });

  it('drops root, workspace and link entries', () => {
    const path = v3({
      '': { name: 'root', version: '1.0.0' },
      'packages/cli': { name: 'cli', version: '1.0.0' },
      'node_modules/linked': { ...pub('linked'), link: true },
    });
    expect(readDependencies(path, false)).toStrictEqual({
      ok: true,
      dependencies: [],
      excludedPrivate: 0,
    });
  });

  it('derives scoped and aliased names', () => {
    const path = v3({
      'node_modules/a/node_modules/@s/b': pub('@s/b', '2.0.0'),
      'node_modules/alias': pub('real', '3.0.0', { name: 'real' }),
    });
    expect(readDependencies(path, false)).toStrictEqual({
      ok: true,
      dependencies: [
        { name: '@s/b', version: '2.0.0', dev: false },
        { name: 'real', version: '3.0.0', dev: false },
      ],
      excludedPrivate: 0,
    });
  });

  it('excludes non-registry and unresolved entries and counts them', () => {
    const path = v3({
      'node_modules/priv': {
        version: '1.0.0',
        resolved: 'https://npm.internal.example/priv/-/priv-1.0.0.tgz',
      },
      'node_modules/none': { version: '1.0.0' },
      'node_modules/ok': pub('ok'),
    });
    expect(readDependencies(path, false)).toStrictEqual({
      ok: true,
      dependencies: [{ name: 'ok', version: '1.0.0', dev: false }],
      excludedPrivate: 2,
    });
  });

  it('dedupes by name@version and keeps dev only when all copies are dev', () => {
    const path = v3({
      'node_modules/x': pub('x', '1.0.0', { dev: true }),
      'node_modules/a/node_modules/x': pub('x', '1.0.0'),
    });
    expect(readDependencies(path, false)).toStrictEqual({
      ok: true,
      dependencies: [{ name: 'x', version: '1.0.0', dev: false }],
      excludedPrivate: 0,
    });
  });

  it('drops dev dependencies but keeps devOptional under production', () => {
    const path = v3({
      'node_modules/d': pub('d', '1.0.0', { dev: true }),
      'node_modules/o': pub('o', '1.0.0', { devOptional: true }),
    });
    expect(readDependencies(path, true)).toStrictEqual({
      ok: true,
      dependencies: [{ name: 'o', version: '1.0.0', dev: false }],
      excludedPrivate: 0,
    });
  });

  it('skips entries without a version and does not count them as private', () => {
    const path = v3({
      'node_modules/nov': { resolved: `${REG}nov/-/nov-1.0.0.tgz` },
      'node_modules/nov2': {},
      'node_modules/ok': pub('ok'),
    });
    expect(readDependencies(path, false)).toStrictEqual({
      ok: true,
      dependencies: [{ name: 'ok', version: '1.0.0', dev: false }],
      excludedPrivate: 0,
    });
  });
});
