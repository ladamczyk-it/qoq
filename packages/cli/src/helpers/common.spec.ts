import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterAll, beforeAll, describe, it, expect } from 'vitest';

import { capitalizeFirstLetter, omitStartingDotFromPath, readIgnorePatterns } from './common.ts';

describe('capitalizeFirstLetter', () => {
  it.each([
    ['hello', 'Hello'],
    ['world', 'World'],
    ['foo-bar', 'Foo-bar'],
    ['FOO-BAR', 'FOO-BAR'],
  ])('should capitalize first letter of %s to %s', (input, expected) => {
    expect(capitalizeFirstLetter(input)).toBe(expected);
  });
});

describe('omitStartingDotFromPath', () => {
  it.each([
    ['./foo/bar', 'foo/bar'],
    ['foo/bar', 'foo/bar'],
  ])('should omit starting dot from path %s to %s', (input, expected) => {
    expect(omitStartingDotFromPath(input)).toBe(expected);
  });
});

describe('readIgnorePatterns', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'qoq-ignore-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('should return an empty array when the file does not exist', async () => {
    await expect(readIgnorePatterns(join(dir, 'missing.ignore'))).resolves.toStrictEqual([]);
  });

  it('should skip comments and blank lines and keep real patterns', async () => {
    const path = join(dir, '.gitignore');
    writeFileSync(
      path,
      ['# a comment', 'node_modules', '', 'dist', '# another', 'coverage'].join('\n')
    );

    await expect(readIgnorePatterns(path)).resolves.toStrictEqual([
      'node_modules',
      'dist',
      'coverage',
    ]);
  });

  it('should return an empty array for a file with only comments and blanks', async () => {
    const path = join(dir, 'comments-only.ignore');
    writeFileSync(path, ['# only comments', '', '# nothing else'].join('\n'));

    await expect(readIgnorePatterns(path)).resolves.toStrictEqual([]);
  });
});
