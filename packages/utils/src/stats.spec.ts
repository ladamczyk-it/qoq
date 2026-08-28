import { describe, it, expect, vi, afterEach } from 'vitest';

import { sendStats, STATS_URL, PIXEL_URL } from './stats';

const mockFetch = (value: Response | Error) => {
  const fetchMock =
    value instanceof Error ? vi.fn().mockRejectedValue(value) : vi.fn().mockResolvedValue(value);

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendStats', () => {
  it('posts the tool name and options, and stops there when it lands', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }));

    await sendStats('qoq', ['--check', '--fix']);

    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string }];

    expect(url).toBe(STATS_URL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toStrictEqual({ tool: 'qoq', options: ['--check', '--fix'] });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('defaults to no options, for the tools that only count runs', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }));

    await sendStats('structurelint');

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];

    expect(JSON.parse(init.body)).toStrictEqual({ tool: 'structurelint', options: [] });
  });

  it('falls back to the pixel when the POST throws', async () => {
    const fetchMock = mockFetch(new Error('ECONNREFUSED'));

    await sendStats('qoq', ['--check', '--fix']);

    // One `options` per option, and nothing the body did not already carry.
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `${PIXEL_URL}?tool=qoq&options=--check&options=--fix`
    );
  });

  it('falls back to the pixel on a non-2xx, which counted nothing either', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 503 }));

    await sendStats('skillslint');

    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${PIXEL_URL}?tool=skillslint`);
  });

  it('swallows a dead fallback — a failed send is never the caller’s problem', async () => {
    mockFetch(new Error('ECONNREFUSED'));

    await expect(sendStats('qoq')).resolves.toBeUndefined();
  });
});
