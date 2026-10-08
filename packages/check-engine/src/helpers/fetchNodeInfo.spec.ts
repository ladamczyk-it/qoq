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
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(releaseIndex) })
    );

    await expect(fetchNodeInfo('./node.json')).resolves.toStrictEqual({
      currentLts: 'v20.1.0',
      maintainedLts: 'v18.1.0',
    });
    expect(readJsonSync).not.toHaveBeenCalled();
  });

  it('falls back to the local snapshot when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.mocked(readJsonSync).mockReturnValue(releaseIndex);

    await expect(fetchNodeInfo('./node.json')).resolves.toStrictEqual({
      currentLts: 'v20.1.0',
      maintainedLts: 'v18.1.0',
    });
    expect(readJsonSync).toHaveBeenCalledWith('./node.json');
  });

  it('calls fetch with an AbortSignal', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(releaseIndex) });

    vi.stubGlobal('fetch', fetchMock);
    await fetchNodeInfo('./node.json');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://nodejs.org/download/release/index.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('falls back to the local snapshot when the response is not OK', async () => {
    const json = vi.fn();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json }));
    vi.mocked(readJsonSync).mockReturnValue(releaseIndex);

    await expect(fetchNodeInfo('./node.json')).resolves.toStrictEqual({
      currentLts: 'v20.1.0',
      maintainedLts: 'v18.1.0',
    });
    expect(readJsonSync).toHaveBeenCalledWith('./node.json');
    expect(json).not.toHaveBeenCalled();
  });

  it('throws a message naming the URL, file, project root and --no-lts when both sources fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.mocked(readJsonSync).mockImplementation(() => {
      throw new Error('no file');
    });

    const message = await fetchNodeInfo('./node.json').then(
      () => '',
      (error: Error) => error.message
    );

    for (const fragment of [
      'https://nodejs.org/download/release/index.json',
      './node.json',
      'project root',
      '--no-lts',
    ]) {
      expect(message).toContain(fragment);
    }
  });
});
