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

// scan-report.json, written through AbstractExecutor.writeReport()
export interface IScanReport {
  status: TScanStatus;
  reason?: string;
  adapter: string;
  findings: IScanFinding[];
}
