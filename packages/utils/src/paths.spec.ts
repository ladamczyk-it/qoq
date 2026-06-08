import { resolve } from 'path';

import { describe, it, expect } from 'vitest';

import { getRelativePath, resolveCwdPath, resolveCwdRelativePath } from './paths';

describe('getRelativePath', () => {
  it('replaces the cwd prefix with a dot', () => {
    expect(getRelativePath(`${process.cwd()}/src/index.ts`)).toBe('./src/index.ts');
  });

  it('leaves a path without the cwd prefix unchanged', () => {
    expect(getRelativePath('/elsewhere/file.ts')).toBe('/elsewhere/file.ts');
  });
});

describe('resolveCwdPath', () => {
  it('resolves a path against the cwd', () => {
    expect(resolveCwdPath('/src/index.ts')).toBe(resolve(`${process.cwd()}/src/index.ts`));
  });
});

describe('resolveCwdRelativePath', () => {
  it('resolves against the cwd and returns it relative to the cwd', () => {
    expect(resolveCwdRelativePath('/src/index.ts')).toBe('./src/index.ts');
  });
});
