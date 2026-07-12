import { readFileSync } from 'node:fs';

import { afterEach, describe, it, expect, vi } from 'vitest';

import { readJsonSync } from './readJson.ts';

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  readFileSync: vi.fn(),
}));

describe('readJsonSync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses and returns the file contents as the requested type', () => {
    vi.mocked(readFileSync).mockReturnValue('{ "name": "demo", "version": "1.0.0" }');

    expect(readJsonSync<{ name: string; version: string }>('package.json')).toStrictEqual({
      name: 'demo',
      version: '1.0.0',
    });
    expect(readFileSync).toHaveBeenCalledWith('package.json', 'utf-8');
  });

  it('throws a parse error when the file is not valid JSON', () => {
    vi.mocked(readFileSync).mockReturnValue('{ not json');

    expect(() => readJsonSync('broken.json')).toThrow('Could not parse file: broken.json');
  });

  it('throws a read error when the file cannot be read', () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(() => readJsonSync('missing.json')).toThrow('Could not read file: missing.json');
  });
});
