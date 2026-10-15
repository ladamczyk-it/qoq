import type { IScanAdapter, IScanDependency, IScanFinding, TScanSeverity } from './types.ts';

const API = 'https://api.osv.dev/v1';
const CHUNK = 1000;
const IN_FLIGHT = 10;

interface IOsvRecord {
  database_specific?: { severity?: string };
  affected?: {
    package?: { ecosystem?: string; name?: string };
    ranges?: { events?: { fixed?: string }[] }[];
  }[];
}

type TVer = [number, number, number];

const parse = (v: string): TVer | undefined => {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(v);
  return m ? (m.slice(1, 4).map(Number) as TVer) : undefined;
};

const cmp = (a: TVer, b: TVer): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export const pickFixVersion = (installed: string, fixed: string[]): string | undefined => {
  const base = parse(installed);
  if (!base) {
    return undefined;
  }
  let best: { raw: string; v: TVer } | undefined;
  for (const raw of fixed) {
    const v = parse(raw);
    if (v && cmp(v, base) > 0 && (!best || cmp(v, best.v) < 0)) {
      best = { raw, v };
    }
  }
  return best?.raw;
};

const getJson = async <T>(url: string, signal: AbortSignal, body?: unknown): Promise<T> => {
  const res = await fetch(
    url,
    body === undefined
      ? { signal }
      : {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
          signal,
        }
  );
  if (!res.ok) {
    throw new Error(`OSV ${url} responded ${res.status}`);
  }
  return (await res.json()) as T;
};

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const osvAdapter: IScanAdapter = {
  name: 'osv',
  async scan(deps, { signal }) {
    const hits: { dep: IScanDependency; id: string }[] = [];
    let reason: string | undefined;

    // ponytail: next_page_token ignored — a single query with >1000 advisories is truncated,
    // so the report can claim `complete` while missing some. Follow the token if that bites.
    try {
      for (let i = 0; i < deps.length; i += CHUNK) {
        const chunk = deps.slice(i, i + CHUNK);
        const { results } = await getJson<{ results: { vulns?: { id: string }[] }[] }>(
          `${API}/querybatch`,
          signal,
          {
            queries: chunk.map((d) => ({
              package: { name: d.name, ecosystem: 'npm' },
              version: d.version,
            })),
          }
        );
        chunk.forEach((dep, j) => results[j]?.vulns?.forEach(({ id }) => hits.push({ dep, id })));
      }
    } catch (e) {
      reason = message(e);
    }

    const records = new Map<string, IOsvRecord | undefined>();
    const ids = [...new Set(hits.map((h) => h.id))];
    const queue = ids.values();
    const worker = async (): Promise<void> => {
      for (const id of queue) {
        try {
          records.set(
            id,
            await getJson<IOsvRecord>(`${API}/vulns/${encodeURIComponent(id)}`, signal)
          );
        } catch (e) {
          records.set(id, undefined);
          reason ??= message(e);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(IN_FLIGHT, ids.length) }, worker));

    const findings = hits.map(({ dep, id }): IScanFinding => {
      const rec = records.get(id);
      const severity = (rec?.database_specific?.severity?.toLowerCase() ??
        'unknown') as TScanSeverity;
      const fixed = (rec?.affected ?? [])
        .filter((a) => a.package?.ecosystem === 'npm' && a.package.name === dep.name)
        .flatMap((a) => a.ranges ?? [])
        .flatMap((r) => r.events ?? [])
        .flatMap((ev) => (ev.fixed ? [ev.fixed] : []));
      const fixVersion = pickFixVersion(dep.version, fixed);
      return {
        package: dep.name,
        version: dep.version,
        id,
        severity,
        url: `https://osv.dev/vulnerability/${encodeURIComponent(id)}`,
        ...(fixVersion && { fixVersion }),
      };
    });

    return reason === undefined
      ? { findings, complete: true }
      : { findings, complete: false, reason };
  },
};
