import { writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { dummyModulesConfig } from '__tests__/common.ts';

import { IExecutorOptions } from '../types.ts';

import { readDependencies } from './readDependencies.ts';
import { formatTable, ScanExecutor } from './ScanExecutor.ts';

import type { IScanAdapter, IScanConfig, IScanFinding, IScanReport } from './types.ts';

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  writeFileSync: vi.fn(),
}));

vi.mock('./readDependencies.ts', () => ({ readDependencies: vi.fn() }));
vi.mock('./graph.ts', () => ({ formatGraph: vi.fn(() => 'GRAPH\n') }));

const { osvScan } = vi.hoisted(() => ({ osvScan: vi.fn() }));

vi.mock('./osvAdapter.ts', () => ({ osvAdapter: { name: 'osv', scan: osvScan } }));

const baseOptions: IExecutorOptions = {
  output: '.qoq/reports',
  fix: false,
  disableCache: true,
  concurrency: 'off',
};

const highFinding: IScanFinding = {
  package: 'lodash',
  version: '4.17.20',
  id: 'GHSA-35jh-r3h4-6jhm',
  severity: 'high',
  fixVersion: '4.17.21',
};

const fakeAdapter = (scan: IScanAdapter['scan']): IScanAdapter => ({ name: 'fake', scan });

const resolvingScan = (findings: unknown[], complete = true, reason?: string) =>
  vi.fn().mockResolvedValue({ findings, complete, reason });

const resolving = (findings: unknown[], complete = true, reason?: string): IScanAdapter =>
  fakeAdapter(resolvingScan(findings, complete, reason));

const executor = (scan: IScanConfig, silent = false, timeout?: number) =>
  new ScanExecutor({ ...dummyModulesConfig, rawConfig: { scan } }, silent, true, timeout);

const writes: string[] = [];
const stdout = () => writes.join('');

const writtenReport = (): IScanReport => {
  const call = vi
    .mocked(writeFileSync)
    .mock.calls.find(([path]) => path === '.qoq/reports/scan-report.json');

  return JSON.parse(call?.[1] as string) as IScanReport;
};

beforeEach(() => {
  writes.length = 0;
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    writes.push(String(chunk));

    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  vi.mocked(readDependencies).mockReturnValue({
    ok: true,
    dependencies: [{ name: 'lodash', version: '4.17.20', dev: false }],
    excludedPrivate: 0,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(readDependencies).mockReset();
  osvScan.mockReset();
  vi.mocked(writeFileSync).mockReset();
});

describe('ScanExecutor exit code and output', () => {
  it('should print the graph only under --graph and only with findings', async () => {
    await executor({ adapter: resolving([highFinding]) }).run(baseOptions);
    expect(stdout()).not.toContain('GRAPH');

    await executor({ adapter: resolving([]) }).run({ ...baseOptions, graph: true });
    expect(stdout()).not.toContain('GRAPH');

    await executor({ adapter: resolving([highFinding]) }).run({ ...baseOptions, graph: true });
    expect(stdout()).toContain('GRAPH');
  });

  it('should fail on a high finding with failOn unset and print its row', async () => {
    const code = await executor({ adapter: resolving([highFinding]) }).run(baseOptions);

    expect(code).toBe(EExitCode.ERROR);
    expect(stdout()).toMatch(/lodash\s+4\.17\.20\s+GHSA-35jh-r3h4-6jhm\s+high\s+4\.17\.21/);
    expect(stdout()).toContain('scan: 1 finding');
  });

  it('should pass a high finding when failOn is critical', async () => {
    const code = await executor({ adapter: resolving([highFinding]), failOn: 'critical' }).run(
      baseOptions
    );

    expect(code).toBe(EExitCode.OK);
    expect(stdout()).toContain('scan: 1 finding');
  });

  it('should pass a critical finding when failOn is none', async () => {
    const code = await executor({
      adapter: resolving([{ ...highFinding, severity: 'critical' }]),
      failOn: 'none',
    }).run(baseOptions);

    expect(code).toBe(EExitCode.OK);
    expect(stdout()).toContain('scan: 1 finding');
  });

  it('should rank an unknown finding as critical against failOn', async () => {
    const code = await executor({
      adapter: resolving([{ ...highFinding, severity: 'unknown' }]),
      failOn: 'critical',
    }).run(baseOptions);

    expect(code).toBe(EExitCode.ERROR);
  });

  it('should report MEDIUM as moderate and bogus as unknown', async () => {
    await executor({
      adapter: resolving([
        { ...highFinding, id: 'A', severity: 'MEDIUM' },
        { ...highFinding, id: 'B', severity: 'bogus' },
      ]),
    }).run({ ...baseOptions, json: 'true' });

    const severities = writtenReport().findings.map((f) => f.severity);

    expect(severities).toStrictEqual(['moderate', 'unknown']);
  });
});

describe('ScanExecutor skipped and inconclusive', () => {
  it('should skip without calling the adapter when the lockfile is unreadable', async () => {
    vi.mocked(readDependencies).mockReturnValue({ ok: false, reason: 'no package-lock.json' });
    const scan = resolvingScan([]);

    const code = await executor({ adapter: fakeAdapter(scan) }).run(baseOptions);

    expect(stdout()).toContain('scan: skipped (no package-lock.json)');
    expect(code).toBe(EExitCode.OK);
    expect(scan).not.toHaveBeenCalled();
  });

  it('should skip with the message when the adapter rejects', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    const code = await executor({
      adapter: fakeAdapter(vi.fn().mockRejectedValue(new Error('boom'))),
    }).run(baseOptions);

    expect(stdout()).toContain('scan: skipped (boom)');
    expect(code).toBe(EExitCode.OK);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should skip on timeout when the adapter never settles', async () => {
    const start = performance.now();

    const neverSettles = () =>
      new Promise<never>(() => {
        // never settles
      });

    const code = await executor({ adapter: fakeAdapter(neverSettles) }, false, 50).run(baseOptions);

    expect(performance.now() - start).toBeLessThan(50 + 1000 + 500);
    expect(stdout()).toContain('scan: skipped (timeout after 50ms)');
    expect(code).toBe(EExitCode.OK);
  });

  it('should be inconclusive with the adapter reason and still print the finding', async () => {
    const code = await executor({
      adapter: resolving([{ ...highFinding, severity: 'critical' }], false, 'partial'),
    }).run(baseOptions);

    expect(stdout()).toContain('scan: inconclusive (partial)');
    expect(stdout()).toMatch(/lodash\s+4\.17\.20\s+GHSA-35jh-r3h4-6jhm\s+critical/);
    expect(code).toBe(EExitCode.OK);
  });

  it('should skip when the adapter returns null', async () => {
    await executor({ adapter: fakeAdapter(vi.fn().mockResolvedValue(null)) }).run(baseOptions);

    expect(stdout()).toContain('scan: skipped (adapter returned an invalid result)');
  });
});

describe('ScanExecutor edge cases', () => {
  it('should report clean without calling the adapter when nothing is installed', async () => {
    vi.mocked(readDependencies).mockReturnValue({
      ok: true,
      dependencies: [],
      excludedPrivate: 0,
    });
    const scan = resolvingScan([]);

    const code = await executor({ adapter: fakeAdapter(scan) }).run(baseOptions);

    expect(stdout()).toContain('scan: clean');
    expect(scan).not.toHaveBeenCalled();
    expect(code).toBe(EExitCode.OK);
  });

  it('should mention excluded non-registry packages', async () => {
    vi.mocked(readDependencies).mockReturnValue({
      ok: true,
      dependencies: [{ name: 'lodash', version: '4.17.20', dev: false }],
      excludedPrivate: 2,
    });

    await executor({ adapter: resolving([]) }).run(baseOptions);

    expect(stdout()).toContain('excluded 2 non-registry package(s)');
  });

  it('should skip when the adapter throws synchronously', async () => {
    const code = await executor({
      adapter: fakeAdapter(() => {
        throw new Error('sync boom');
      }),
    }).run(baseOptions);

    expect(stdout()).toContain('scan: skipped (sync boom)');
    expect(code).toBe(EExitCode.OK);
  });

  it('should report a partial result after abort as an inconclusive timeout', async () => {
    const code = await executor(
      {
        adapter: fakeAdapter(
          (_deps, { signal }) =>
            new Promise((resolve) => {
              signal.addEventListener('abort', () =>
                resolve({ findings: [{ ...highFinding, severity: 'critical' }], complete: false })
              );
            })
        ),
      },
      false,
      20
    ).run(baseOptions);

    expect(stdout()).toContain('scan: inconclusive (timeout after 20ms)');
    expect(code).toBe(EExitCode.OK);
  });

  it('should fall back to incomplete scan when the adapter gives no reason', async () => {
    await executor({ adapter: resolving([], false) }).run(baseOptions);

    expect(stdout()).toContain('scan: inconclusive (incomplete scan)');
  });
});

describe('ScanExecutor configuration', () => {
  it('should fall back to the config timeout when the constructor timeout is NaN', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

    await executor({ adapter: resolving([]), timeout: 2000 }, true, Number.NaN).run(baseOptions);

    expect(timeoutSpy).toHaveBeenCalledWith(2000);
  });

  it('should default the timeout to 10000', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

    await executor({ adapter: resolving([]) }, true).run(baseOptions);

    expect(timeoutSpy).toHaveBeenCalledWith(10000);
  });

  it('should call osvAdapter when no adapter is configured', async () => {
    osvScan.mockResolvedValue({ findings: [], complete: true });

    await executor({}, true).run(baseOptions);

    expect(osvScan).toHaveBeenCalled();
  });

  it('should pass production to readDependencies', async () => {
    await executor({ adapter: resolving([]) }, true).run({ ...baseOptions, production: true });

    expect(vi.mocked(readDependencies).mock.calls[0]?.[1]).toBe(true);
  });
});

describe('ScanExecutor ordering and reports', () => {
  it('should order findings by severity, then package, then id', async () => {
    const f = (severity: string, pkg: string, id: string) => ({
      ...highFinding,
      severity,
      package: pkg,
      id,
    });

    await executor({
      adapter: resolving([
        f('unknown', 'a', '1'),
        f('low', 'a', '1'),
        f('high', 'b', '2'),
        f('high', 'b', '1'),
        f('high', 'a', '9'),
        f('moderate', 'a', '1'),
        f('critical', 'z', '1'),
      ]),
    }).run({ ...baseOptions, json: 'true' });

    const order = writtenReport().findings.map((x) => `${x.severity}:${x.package}:${x.id}`);

    expect(order).toStrictEqual([
      'critical:z:1',
      'high:a:9',
      'high:b:1',
      'high:b:2',
      'moderate:a:1',
      'low:a:1',
      'unknown:a:1',
    ]);
  });

  it('should write a findings report and print the status line without a table', async () => {
    await executor({ adapter: resolving([highFinding]) }).run({ ...baseOptions, json: 'true' });

    expect(writtenReport()).toStrictEqual({
      status: 'findings',
      adapter: 'fake',
      findings: [highFinding],
    });
    expect(stdout()).toContain('scan: 1 finding');
    expect(stdout()).not.toContain('GHSA-35jh-r3h4-6jhm');
  });

  it('should write a skipped report', async () => {
    vi.mocked(readDependencies).mockReturnValue({ ok: false, reason: 'no package-lock.json' });

    await executor({ adapter: resolving([]) }).run({ ...baseOptions, json: 'true' });

    expect(writtenReport()).toStrictEqual({
      status: 'skipped',
      reason: 'no package-lock.json',
      adapter: 'fake',
      findings: [],
    });
    expect(stdout()).toContain('scan: skipped (no package-lock.json)');
  });

  it('should print a dash for a missing fix and pluralise the status line', async () => {
    await executor({
      adapter: resolving([
        { ...highFinding, fixVersion: undefined },
        { ...highFinding, id: 'B', fixVersion: 42 },
      ]),
    }).run(baseOptions);

    expect(stdout()).toMatch(/GHSA-35jh-r3h4-6jhm\s+high\s+-\n/);
    expect(stdout()).toMatch(/B\s+high\s+-\n/);
    expect(stdout()).toContain('scan: 2 findings');
  });

  it('should write nothing to stdout when silent', async () => {
    const scan = resolvingScan([highFinding]);

    const code = await executor({ adapter: fakeAdapter(scan) }, true).run(baseOptions);

    expect(writes).toStrictEqual([]);
    expect(scan).toHaveBeenCalled();
    expect(code).toBe(EExitCode.ERROR);
  });

  it('should link the ID to its url only when links are on, keeping alignment', () => {
    const url = 'https://osv.dev/vulnerability/X';
    const link = `\u001b]8;;${url}\u001b\\${highFinding.id}\u001b]8;;\u001b\\`;
    const strip = (s: string) =>
      s.replaceAll(`\u001b]8;;${url}\u001b\\`, '').replaceAll('\u001b]8;;\u001b\\', '');
    const findings = [{ ...highFinding, url }];

    expect(formatTable(findings, true)).toContain(link);
    expect(strip(formatTable(findings, true))).toBe(formatTable(findings, false));
    expect(formatTable(findings, false)).not.toContain('osv.dev');
  });
});
