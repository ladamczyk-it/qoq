import { EExitCode, resolveCwdPath } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { AbstractApiExecutor } from '../abstract/AbstractApiExecutor.ts';
import { IExecutorOptions, IModulesConfig } from '../types.ts';

import { osvAdapter } from './osvAdapter.ts';
import { readDependencies } from './readDependencies.ts';

import type {
  IScanAdapter,
  IScanFinding,
  IScanReport,
  IScanResult,
  TScanSeverity,
} from './types.ts';

const DEFAULT_TIMEOUT = 10000;
// ponytail: grace is fixed; make it configurable if adapters need longer to flush partials.
const GRACE_MS = 1000;
const TIMED_OUT = Symbol('timeout');

const RANK: Record<TScanSeverity, number> = {
  critical: 4,
  high: 3,
  moderate: 2,
  low: 1,
  unknown: 0,
};

const normaliseSeverity = (severity: unknown): TScanSeverity => {
  const s = String(severity).toLowerCase();
  const mapped = s === 'medium' ? 'moderate' : s;

  return mapped in RANK ? (mapped as TScanSeverity) : 'unknown';
};

const normalise = ({ fixVersion, ...finding }: IScanFinding): IScanFinding => ({
  ...finding,
  severity: normaliseSeverity(finding.severity),
  ...(typeof fixVersion === 'string' ? { fixVersion } : {}),
});

const compare = (a: IScanFinding, b: IScanFinding): number =>
  RANK[b.severity] - RANK[a.severity] ||
  a.package.localeCompare(b.package) ||
  a.id.localeCompare(b.id);

const formatTable = (findings: IScanFinding[]): string => {
  const rows = [
    ['package', 'version', 'ID', 'severity', 'fix'],
    ...findings.map((f) => [f.package, f.version, f.id, f.severity, f.fixVersion ?? '-']),
  ];
  const widths = rows.reduce(
    (max, row) => row.map((cell, i) => Math.max(cell.length, max[i] ?? 0)),
    [] as number[]
  );

  const line = (row: string[]) =>
    row
      .map((cell, i) => cell.padEnd(widths[i] ?? 0))
      .join('  ')
      .trimEnd();

  return rows.map((row) => `${line(row)}\n`).join('');
};

const statusLine = ({ status, reason, findings }: IScanReport): string => {
  switch (status) {
    case 'clean':
      return c.green('scan: clean');
    case 'findings':
      return c.red(`scan: ${findings.length} finding${findings.length === 1 ? '' : 's'}`);
    default:
      return c.yellow(`scan: ${status} (${reason})`);
  }
};

// An adapter is user code, so its result is checked rather than trusted.
const isScanResult = (value: unknown): value is IScanResult =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as Partial<IScanResult>).findings);

const firstValidTimeout = (...candidates: unknown[]): number =>
  candidates.map(Number).find((n) => Number.isFinite(n) && n > 0) ?? DEFAULT_TIMEOUT;

// Kept out of execute()'s registry on purpose: a network scan doesn't belong in
// every check run. May later become an opt-in flag on `--check` for pre-push once
// real-world scan timing is validated.
export class ScanExecutor extends AbstractApiExecutor {
  constructor(
    modulesConfig: IModulesConfig,
    silent: boolean = false,
    hideTimer: boolean = false,
    private readonly timeout?: number
  ) {
    super(modulesConfig, silent, hideTimer);
  }

  // Advisory like NpmExecutor: every failure becomes a `skipped` status, since a
  // throw out of execute() would process.exit(2) via run().
  protected async execute(_args: string[], options: IExecutorOptions): Promise<EExitCode> {
    const cfg = this.modulesConfig.rawConfig?.scan ?? {};
    const adapter = cfg.adapter ?? osvAdapter;
    const failOn = cfg.failOn ?? 'high';
    const report = await this.scan(adapter, cfg.timeout, !!options.production);
    const full: IScanReport = { ...report, adapter: adapter.name };

    if (options.json) {
      this.writeReport(full, options.output);
    }

    if (!this.silent) {
      if (!options.json && full.findings.length > 0) {
        process.stdout.write(formatTable(full.findings));
      }
      process.stdout.write(`${statusLine(full)}\n`);
    }

    const failing =
      full.status === 'findings' &&
      failOn !== 'none' &&
      full.findings.some(
        (f) => (f.severity === 'unknown' ? RANK.critical : RANK[f.severity]) >= RANK[failOn]
      );

    return failing ? EExitCode.ERROR : EExitCode.OK;
  }

  private async scan(
    adapter: IScanAdapter,
    cfgTimeout: unknown,
    production: boolean
  ): Promise<Omit<IScanReport, 'adapter'>> {
    const read = readDependencies(resolveCwdPath('/package-lock.json'), production);

    if (!read.ok) {
      return { status: 'skipped', reason: read.reason, findings: [] };
    }
    if (!this.silent && read.excludedPrivate > 0) {
      process.stdout.write(c.gray(`excluded ${read.excludedPrivate} non-registry package(s)\n`));
    }
    if (read.dependencies.length === 0) {
      return { status: 'clean', findings: [] };
    }

    const ms = firstValidTimeout(this.timeout, cfgTimeout);
    const signal = AbortSignal.timeout(ms);
    let grace: NodeJS.Timeout | undefined;
    const timedOut = new Promise<typeof TIMED_OUT>((resolve) => {
      signal.addEventListener(
        'abort',
        () => {
          grace = setTimeout(() => resolve(TIMED_OUT), GRACE_MS);
        },
        { once: true }
      );
    });
    let result: unknown;

    try {
      result = await Promise.race([
        (async () => adapter.scan(read.dependencies, { signal }))(),
        timedOut,
      ]);
    } catch (error) {
      return {
        status: 'skipped',
        reason: error instanceof Error ? error.message : String(error),
        findings: [],
      };
    } finally {
      clearTimeout(grace);
    }

    if (result === TIMED_OUT) {
      return { status: 'skipped', reason: `timeout after ${ms}ms`, findings: [] };
    }
    if (!isScanResult(result)) {
      return { status: 'skipped', reason: 'adapter returned an invalid result', findings: [] };
    }

    const findings = result.findings.map(normalise).sort(compare);

    if (!result.complete) {
      const reason = signal.aborted
        ? `timeout after ${ms}ms`
        : (result.reason ?? 'incomplete scan');

      return { status: 'inconclusive', reason, findings };
    }

    return { status: findings.length > 0 ? 'findings' : 'clean', findings };
  }

  protected getCommandName(): string {
    return 'scan';
  }

  protected prepare(): Promise<void> {
    return Promise.resolve();
  }
}
