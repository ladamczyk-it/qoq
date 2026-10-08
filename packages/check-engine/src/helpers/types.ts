/* eslint-disable @typescript-eslint/naming-convention -- names are fixed by the milestone contract */
export type DependencyGroup =
  'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';
type SkipReason = 'not-installed' | 'no-engines' | 'malformed-range';

/** Checked dependencies only. */
export interface DependencyRequirement {
  name: string;
  group: DependencyGroup;
  range: string;
}
export interface SkippedDependency {
  name: string;
  group: DependencyGroup;
  reason: SkipReason;
  /** Only set for 'malformed-range'. */
  range: string | null;
}
export interface Conflict {
  dependency: string;
  group: DependencyGroup;
  range: string;
  /** Exact vs ranged engines.node. */
  why: 'not-in-range' | 'not-subset';
  /** semver.minVersion(range). */
  dependencyFloor: string | null;
}
export interface WorkspaceBase {
  /** Workspace dir relative to cwd, '.' for root. */
  path: string;
  /** Relative to cwd. */
  packageJsonPath: string;
  /** Raw engines.node, null when absent. */
  configured: string | null;
  /** minVersion(configured); null if absent/invalid. */
  configuredFloor: string | null;
  /** Lowest version satisfying every dependency range. */
  floor: string | null;
  requirements: DependencyRequirement[];
  skipped: SkippedDependency[];
  counts: { checked: number; skipped: number };
  /** Always [] in Milestone 1. */
  advisories: string[];
}
export type WorkspaceResult = WorkspaceBase &
  (
    | { status: 'pass' }
    | { status: 'fail'; reason: 'incompatible'; conflicts: Conflict[] }
    | { status: 'fail'; reason: 'invalid-engines' | 'unreadable'; message: string }
  );
