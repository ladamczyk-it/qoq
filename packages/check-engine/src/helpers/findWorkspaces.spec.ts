import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findWorkspaces } from './findWorkspaces.ts';

const ROOT = './package.json';

describe('findWorkspaces', () => {
  let cwd: string;

  const addPackage = (dir: string): void => {
    const file = join(cwd, dir, 'package.json');

    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, '{}');
  };

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'find-workspaces-'));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('should return the root first, then the glob matches sorted', () => {
    addPackage('packages/b');
    addPackage('packages/a');

    expect(findWorkspaces(cwd, ['packages/*'])).toStrictEqual([
      ROOT,
      'packages/a/package.json',
      'packages/b/package.json',
    ]);
  });

  it('should accept the { packages } object form', () => {
    addPackage('packages/a');
    addPackage('packages/b');

    expect(findWorkspaces(cwd, { packages: ['packages/*'] })).toStrictEqual(
      findWorkspaces(cwd, ['packages/*'])
    );
  });

  it('should return only the root when workspaces is undefined or has no packages', () => {
    expect(findWorkspaces(cwd, undefined)).toStrictEqual([ROOT]);
    expect(findWorkspaces(cwd, {})).toStrictEqual([ROOT]);
  });

  it('should match nested packages with ** and never return node_modules', () => {
    addPackage('packages/x/y');
    addPackage('packages/x/node_modules/dep');

    expect(findWorkspaces(cwd, ['packages/**'])).toStrictEqual([ROOT, 'packages/x/y/package.json']);
  });

  it('should treat !pattern as an exclude of the whole subtree', () => {
    addPackage('packages/a');
    addPackage('packages/legacy');
    addPackage('packages/legacy/inner');

    expect(findWorkspaces(cwd, ['packages/**', '!packages/legacy'])).toStrictEqual([
      ROOT,
      'packages/a/package.json',
    ]);
  });

  it('should return a literal path verbatim even when it does not exist', () => {
    expect(findWorkspaces(cwd, ['libs/missing'])).toStrictEqual([
      ROOT,
      'libs/missing/package.json',
    ]);
  });

  it('should skip glob-matched directories without a package.json', () => {
    addPackage('packages/a');
    mkdirSync(join(cwd, 'packages/empty'), { recursive: true });

    expect(findWorkspaces(cwd, ['packages/*'])).toStrictEqual([ROOT, 'packages/a/package.json']);
  });

  it('should deduplicate overlapping patterns', () => {
    addPackage('packages/a');

    expect(findWorkspaces(cwd, ['packages/*', 'packages/a', 'packages/**'])).toStrictEqual([
      ROOT,
      'packages/a/package.json',
    ]);
  });

  it('should emit no Node warning on the first globSync use in a fresh process', () => {
    addPackage('packages/a');
    const modulePath = fileURLToPath(new URL('./findWorkspaces.ts', import.meta.url));
    const script = `import { findWorkspaces } from ${JSON.stringify(modulePath)};
      console.log(JSON.stringify(findWorkspaces(${JSON.stringify(cwd)}, ['packages/*'])));`;
    const env = { ...process.env, NODE_OPTIONS: '' };

    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      env,
    });

    expect(child.stderr).not.toContain('ExperimentalWarning');
    expect(child.status).toBe(0);
    expect(JSON.parse(child.stdout)).toStrictEqual([ROOT, 'packages/a/package.json']);
  });
});
