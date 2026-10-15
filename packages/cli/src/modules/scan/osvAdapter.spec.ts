import { afterEach, describe, expect, it, vi } from 'vitest';

import { osvAdapter, pickFixVersion } from './osvAdapter.ts';

import type { IScanDependency } from './types.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const dep = (name: string, version = '1.0.0'): IScanDependency => ({ name, version, dev: false });
const BATCH = 'https://api.osv.dev/v1/querybatch';
const VULN = 'https://api.osv.dev/v1/vulns/';

interface IBatchBody {
  queries: { package: { name: string; ecosystem: string }; version: string }[];
}

type TFetchMock = ReturnType<typeof vi.fn>;

// Routes querybatch to `vulnsFor(queryIndexWithinChunk, chunkIndex)` and vulns/{id} to `records[id]`.
const stubOsv = (opts: {
  vulns?: (query: IBatchBody['queries'][number]) => { id: string; modified: string }[];
  records?: Record<string, unknown>;
  detail?: (id: string) => Promise<Response>;
}): TFetchMock => {
  const mock = vi.fn((url: string, init?: RequestInit) => {
    if (url === BATCH) {
      const body = JSON.parse(init?.body as string) as IBatchBody;
      return Promise.resolve(
        json({ results: body.queries.map((q) => ({ vulns: opts.vulns?.(q) ?? [] })) })
      );
    }
    const id = url.slice(VULN.length);
    return opts.detail ? opts.detail(id) : Promise.resolve(json(opts.records?.[id] ?? { id }));
  });
  vi.stubGlobal('fetch', mock);
  return mock;
};

const scan = (deps: IScanDependency[], signal = new AbortController().signal) =>
  osvAdapter.scan(deps, { signal });

const record = (name: string, fixed: string[], severity?: string) => ({
  id: 'x',
  ...(severity ? { database_specific: { severity } } : {}),
  affected: [
    {
      package: { ecosystem: 'npm', name },
      ranges: [{ events: fixed.map((f) => ({ fixed: f })) }],
    },
  ],
});

describe('osvAdapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is named osv', () => {
    expect(osvAdapter.name).toBe('osv');
  });

  it('splits 2500 dependencies into querybatch POSTs of 1000, 1000 and 500', async () => {
    const mock = stubOsv({});
    const deps = Array.from({ length: 2500 }, (_, i) => dep(`p${i}`));

    const result = await scan(deps);

    const posts = mock.mock.calls.filter(([url]) => url === BATCH);
    const bodies = posts.map(([, init]) => JSON.parse(init.body as string) as IBatchBody);
    expect(bodies.map((b) => b.queries.length)).toStrictEqual([1000, 1000, 500]);
    expect(posts.every(([, init]) => init?.method === 'POST')).toBe(true);
    expect(bodies[0]?.queries[0]).toStrictEqual({
      package: { name: 'p0', ecosystem: 'npm' },
      version: '1.0.0',
    });
    expect(bodies.flatMap((b) => b.queries).every((q) => q.package.ecosystem === 'npm')).toBe(true);
    expect(result).toStrictEqual({ findings: [], complete: true });
  });

  it('fetches an advisory shared by two dependencies once and reports both', async () => {
    const mock = stubOsv({
      vulns: () => [{ id: 'GHSA-1', modified: 'm' }],
      records: { 'GHSA-1': { id: 'GHSA-1' } },
    });

    const result = await scan([dep('a'), dep('b')]);

    expect(mock.mock.calls.filter(([url]) => url === `${VULN}GHSA-1`)).toHaveLength(1);
    expect(result.findings.map((f) => f.package)).toStrictEqual(['a', 'b']);
    expect(result.findings.every((f) => f.id === 'GHSA-1')).toBe(true);
  });

  it('keeps at most 10 detail requests in flight', async () => {
    let pending = 0;
    let max = 0;
    stubOsv({
      vulns: () => Array.from({ length: 25 }, (_, i) => ({ id: `ID-${i}`, modified: 'm' })),
      detail: async (id) => {
        pending++;
        max = Math.max(max, pending);
        await new Promise((r) => {
          setTimeout(r, 5);
        });
        pending--;
        return json({ id });
      },
    });

    const result = await scan([dep('a')]);

    expect(result.findings).toHaveLength(25);
    expect(max).toBeGreaterThan(1);
    expect(max).toBeLessThanOrEqual(10);
  });

  it('maps database_specific.severity to lower case and defaults to unknown', async () => {
    stubOsv({
      vulns: () => [
        { id: 'A', modified: 'm' },
        { id: 'B', modified: 'm' },
      ],
      records: { A: { id: 'A', database_specific: { severity: 'MODERATE' } }, B: { id: 'B' } },
    });

    const result = await scan([dep('a')]);

    expect(result.findings.map((f) => f.severity)).toStrictEqual(['moderate', 'unknown']);
  });

  it('takes fixVersion only from affected entries matching name and npm ecosystem', async () => {
    stubOsv({
      vulns: () => [{ id: 'A', modified: 'm' }],
      records: {
        A: {
          id: 'A',
          affected: [
            {
              package: { ecosystem: 'npm', name: 'other' },
              ranges: [{ events: [{ fixed: '1.0.1' }] }],
            },
            {
              package: { ecosystem: 'PyPI', name: 'a' },
              ranges: [{ events: [{ fixed: '1.0.2' }] }],
            },
            {
              package: { ecosystem: 'npm', name: 'a' },
              ranges: [{ events: [{ introduced: '0' }, { fixed: '1.5.0' }] }],
            },
          ],
        },
      },
    });

    const result = await scan([dep('a')]);

    expect(result.findings).toStrictEqual([
      { package: 'a', version: '1.0.0', id: 'A', severity: 'unknown', fixVersion: '1.5.0' },
    ]);
  });

  it('omits fixVersion when nothing matches', async () => {
    stubOsv({
      vulns: () => [{ id: 'A', modified: 'm' }],
      records: { A: record('zzz', ['9.0.0']) },
    });

    const result = await scan([dep('a')]);

    expect(result.findings[0]).not.toHaveProperty('fixVersion');
  });

  it('resolves complete:false with the first chunk findings when a later querybatch returns 500', async () => {
    let call = 0;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === BATCH) {
        call++;
        if (call === 2) {
          return Promise.resolve(json({}, 500));
        }
        const body = JSON.parse(init?.body as string) as IBatchBody;
        return Promise.resolve(
          json({ results: body.queries.map(() => ({ vulns: [{ id: 'A', modified: 'm' }] })) })
        );
      }
      return Promise.resolve(json({ id: 'A' }));
    });
    vi.stubGlobal('fetch', mock);
    const deps = Array.from({ length: 1001 }, (_, i) => dep(`p${i}`));

    const result = await scan(deps);

    expect(result.complete).toBe(false);
    expect(result.findings).toHaveLength(1000);
    expect(result.reason).toBeTruthy();
  });

  it('keeps a finding as unknown and resolves complete:false when a detail fetch rejects', async () => {
    stubOsv({
      vulns: () => [{ id: 'A', modified: 'm' }],
      detail: () => Promise.reject(new Error('boom')),
    });

    const result = await scan([dep('a')]);

    expect(result).toStrictEqual({
      findings: [{ package: 'a', version: '1.0.0', id: 'A', severity: 'unknown' }],
      complete: false,
      reason: 'boom',
    });
  });

  it('treats a non-2xx detail response as a failed detail fetch', async () => {
    stubOsv({
      vulns: () => [{ id: 'A', modified: 'm' }],
      detail: () => Promise.resolve(json({}, 404)),
    });

    const result = await scan([dep('a')]);

    expect(result.complete).toBe(false);
    expect(result.findings[0]?.severity).toBe('unknown');
  });

  it('passes the ctx signal to every fetch call', async () => {
    const mock = stubOsv({ vulns: () => [{ id: 'A', modified: 'm' }] });
    const { signal } = new AbortController();

    await scan([dep('a')], signal);

    expect(mock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mock.mock.calls.every(([, init]) => init?.signal === signal)).toBe(true);
  });

  it('never rejects when aborted up front', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('aborted')))
    );

    const result = await scan([dep('a')], ctrl.signal);

    expect(result.complete).toBe(false);
    expect(result.findings).toStrictEqual([]);
  });
});

describe('pickFixVersion', () => {
  it('picks the smallest fixed version above the installed one', () => {
    expect(pickFixVersion('1.2.3', ['2.0.0', '1.2.5', '1.1.0'])).toBe('1.2.5');
  });

  it('is undefined when no fixed version is greater', () => {
    expect(pickFixVersion('3.0.0', ['2.0.0'])).toBeUndefined();
  });

  it('ignores prerelease suffixes on the installed version', () => {
    expect(pickFixVersion('1.0.0-beta.1', ['1.0.1'])).toBe('1.0.1');
  });

  it('compares numerically, not lexically', () => {
    expect(pickFixVersion('1.9.0', ['1.10.0'])).toBe('1.10.0');
  });

  it('is undefined for versions that are not x.y.z-shaped', () => {
    expect(pickFixVersion('abc', ['1.0.0'])).toBeUndefined();
    expect(pickFixVersion('1.0.0', ['nope'])).toBeUndefined();
  });
});
