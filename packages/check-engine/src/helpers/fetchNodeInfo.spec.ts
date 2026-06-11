import { afterEach, describe, it, expect, vi } from 'vitest';

import { fetchNodeInfo } from './fetchNodeInfo.ts';
import { readJsonSync } from './readJson.ts';

vi.mock('./readJson.ts', () => ({
  readJsonSync: vi.fn(),
}));

const releaseIndex = [
  { version: 'v20.1.0', date: '2023-05-01', lts: 'Iron', security: true },
  { version: 'v20.2.0', date: '2023-06-01', lts: 'Iron', security: true },
  { version: 'v18.1.0', date: '2022-05-01', lts: 'Hydrogen', security: true },
  { version: 'v16.0.0', date: '2021-01-01', lts: false, security: true },
  { version: 'v19.0.0', date: '2022-11-01', lts: 'NotSecure', security: false },
];

describe('fetchNodeInfo', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('derives the two highest active LTS majors from the network response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve(releaseIndex) })
    );

    await expect(fetchNodeInfo('./node.json')).resolves.toEqual({
      currentLts: 'v20.1.0',
      maintainedLts: 'v18.1.0',
    });
    expect(readJsonSync).not.toHaveBeenCalled();
  });

  it('falls back to the local snapshot when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.mocked(readJsonSync).mockReturnValue(releaseIndex);

    await expect(fetchNodeInfo('./node.json')).resolves.toEqual({
      currentLts: 'v20.1.0',
      maintainedLts: 'v18.1.0',
    });
    expect(readJsonSync).toHaveBeenCalledWith('./node.json');
  });

  it('throws when neither the network nor the local snapshot is available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.mocked(readJsonSync).mockImplementation(() => {
      throw new Error('no file');
    });

    await expect(fetchNodeInfo('./node.json')).rejects.toThrow(
      "Can't read 'https://nodejs.org/download/release/index.json' + no 'node.json' present in root!"
    );
  });
});
