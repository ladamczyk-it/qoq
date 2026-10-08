import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

interface IPackageJson {
  engines?: Record<string, string>;
}

interface ILockfileEntry {
  engines?: Record<string, string>;
}

interface ILockfile {
  packages: Record<string, ILockfileEntry>;
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const NODE_RANGE = '^22.22.2 || ^24.15.0 || >=26.0.0';
const ROOT_NODE_RANGE = '^22.22.2';
const NPM_RANGE = '>= 10';

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8')) as T;

const workspacePackageJsons = (): string[] =>
  readdirSync(join(repoRoot, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join('packages', entry.name, 'package.json'))
    .filter((relativePath) => existsSync(join(repoRoot, relativePath)))
    .sort();

const checkedPackageJsons = ['package.json', ...workspacePackageJsons()];

const isWorkspaceKey = (key: string): boolean => /^packages\/[^/]+$/.test(key);

describe('workspace engines', () => {
  it('root package.json declares the root engines', () => {
    const { engines } = readJson<IPackageJson>('package.json');

    expect(engines?.node).toBe(ROOT_NODE_RANGE);
    expect(engines?.npm).toBe(NPM_RANGE);
  });

  it.each(workspacePackageJsons())('%s declares the shared engines', (relativePath) => {
    const { engines } = readJson<IPackageJson>(relativePath);

    expect(engines?.node).toBe(NODE_RANGE);
    expect(engines?.npm).toBe(NPM_RANGE);
  });

  it('gives every workspace entry the shared engines and the root entry in package-lock.json the root engines', () => {
    const { packages } = readJson<ILockfile>('package-lock.json');
    const workspaceKeys = Object.keys(packages).filter((key) => key === '' || isWorkspaceKey(key));
    const enginesByKey = workspaceKeys.map((key) => ({
      key,
      node: packages[key]?.engines?.node,
      npm: packages[key]?.engines?.npm,
    }));

    expect(workspaceKeys.length).toBeGreaterThan(1);
    expect(enginesByKey).toStrictEqual(
      workspaceKeys.map((key) => ({
        key,
        node: key === '' ? ROOT_NODE_RANGE : NODE_RANGE,
        npm: NPM_RANGE,
      }))
    );
  });

  it('checks the root plus every workspace the lockfile knows about', () => {
    const { packages } = readJson<ILockfile>('package-lock.json');
    const lockedWorkspaces = Object.keys(packages)
      .filter(isWorkspaceKey)
      .map((key) => join(key, 'package.json'))
      .sort();

    expect(checkedPackageJsons).toStrictEqual(['package.json', ...lockedWorkspaces]);
  });
});
