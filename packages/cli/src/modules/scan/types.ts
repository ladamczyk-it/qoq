export type TScanSeverity = 'low' | 'moderate' | 'high' | 'critical' | 'unknown';
type TScanFailOn = Exclude<TScanSeverity, 'unknown'> | 'none';
type TScanStatus = 'clean' | 'findings' | 'skipped' | 'inconclusive';

export interface IScanDependency {
  name: string;
  version: string;
  dev: boolean;
}

export interface IScanFinding {
  package: string;
  version: string;
  id: string;
  severity: TScanSeverity;
  fixVersion?: string;
  url?: string;
}

export interface IScanResult {
  findings: IScanFinding[];
  complete: boolean;
  reason?: string;
}

export interface IScanAdapter {
  name: string;
  scan(deps: IScanDependency[], ctx: { signal: AbortSignal }): Promise<IScanResult>;
}

export interface IScanConfig {
  adapter?: IScanAdapter;
  timeout?: number;
  failOn?: TScanFailOn;
}

// One way a vulnerable package gets installed: the package.json that declares
// `direct`, and the package that requires the vulnerable one. `parent` is
// omitted when the vulnerable package is `direct` itself.
export interface IScanPath {
  manifest: string;
  direct: string;
  parent?: string;
}

// What qoq adds to an adapter's finding from the lockfile; adapters never set these.
export interface IScanReportFinding extends IScanFinding {
  dev: boolean;
  via: IScanPath[];
}

// scan-report.json, written through AbstractExecutor.writeReport()
export interface IScanReport {
  status: TScanStatus;
  reason?: string;
  adapter: string;
  findings: IScanReportFinding[];
}
