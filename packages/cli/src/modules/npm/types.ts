interface INpmOutdatedOutputEntry {
  current: string;
  latest: string;
}

export type TNpmOutdatedOutput = Record<
  string,
  INpmOutdatedOutputEntry | INpmOutdatedOutputEntry[]
>;

// Lean per-package entry written into npm-report.json under `--json` — mirrors
// what summarize.mjs needs, dropping the raw npm outdated per-workspace shape.
export type TNpmOutdatedEntry = {
  name: string;
  current: string;
  latest: string;
};

export enum ENpmWarningType {
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  PATCH = 'PATCH',
}

export interface IModuleNpmConfig {
  checkOutdatedEvery: number;
}
