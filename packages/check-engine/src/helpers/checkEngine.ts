import { dirname, relative, resolve } from 'node:path';

import { getPackageInfo } from '@ladamczyk/qoq-utils';
import { major, minVersion, Range, satisfies, subset, valid, validRange } from 'semver';

import { readJsonSync } from './readJson.ts';

import type {
  Conflict,
  DependencyGroup,
  DependencyRequirement,
  IncludeFlag,
  LtsInfo,
  SkippedDependency,
  WorkspaceBase,
  WorkspaceResult,
} from './types.ts';
import type { PackageJson } from 'type-fest';

const toRelative = (p: string): string => relative(process.cwd(), resolve(p)) || '.';

const floorOf = (range: string): string | null => {
  try {
    return minVersion(range)?.version ?? null;
  } catch {
    return null;
  }
};

// Lowest version satisfying every range; candidates are the minVersion of each comparator set.
const requiredFloor = (ranges: string[]): string | null => {
  const candidates = ranges.flatMap((r) =>
    new Range(r).set.map((comparators) =>
      minVersion(new Range(comparators.map((cmp) => cmp.value).join(' ')))
    )
  );

  return (
    candidates
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => a.compare(b))
      .find((v) => ranges.every((r) => satisfies(v, r)))?.version ?? null
  );
};

const resolveDependencies = (
  packageJsonPath: string,
  names: string[],
  group: DependencyGroup
): { requirements: DependencyRequirement[]; skipped: SkippedDependency[] } => {
  // Resolve from the checked package's own folder: npm may nest a workspace dependency.
  const paths = [resolve(dirname(packageJsonPath))];
  const requirements: DependencyRequirement[] = [];
  const skipped: SkippedDependency[] = [];

  for (const name of names) {
    let range: string | undefined;

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      range = getPackageInfo(name, { paths }).packageJson?.engines?.node as string | undefined;
    } catch {
      skipped.push({ name, group, reason: 'not-installed', range: null });
      continue;
    }

    if (!range) {
      skipped.push({ name, group, reason: 'no-engines', range: null });
    } else if (validRange(range) === null) {
      skipped.push({ name, group, reason: 'malformed-range', range });
    } else {
      requirements.push({ name, group, range });
    }
  }

  return { requirements, skipped };
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- name fixed by the milestone contract
export interface CheckOptions {
  include: readonly IncludeFlag[];
  lts: LtsInfo | null;
}

const INCLUDED_GROUPS: Record<IncludeFlag, DependencyGroup> = {
  dev: 'devDependencies',
  peer: 'peerDependencies',
  optional: 'optionalDependencies',
};

export const checkEngine = (
  packageJsonPath: string,
  options: CheckOptions = { include: [], lts: null }
): WorkspaceResult => {
  const base: WorkspaceBase = {
    path: toRelative(dirname(packageJsonPath)),
    packageJsonPath: toRelative(packageJsonPath),
    configured: null,
    configuredFloor: null,
    floor: null,
    requirements: [],
    skipped: [],
    counts: { checked: 0, skipped: 0 },
    advisories: [],
  };

  let pkg: PackageJson;

  try {
    pkg = readJsonSync<PackageJson>(packageJsonPath);
  } catch (error) {
    return {
      ...base,
      status: 'fail',
      reason: 'unreadable',
      message: error instanceof Error ? error.message : `Could not read file: ${packageJsonPath}`,
    };
  }

  const rawNode = pkg.engines?.node;
  const configured = rawNode === undefined || rawNode === '' ? null : rawNode;
  const isExact = configured !== null && valid(configured) !== null;

  if (configured !== null && !isExact && validRange(configured) === null) {
    return {
      ...base,
      configured,
      status: 'fail',
      reason: 'invalid-engines',
      message: `Bad engines.node version: ${configured}`,
    };
  }

  const useDev = Object.keys(pkg.dependencies ?? {}).length === 0;
  const groups: DependencyGroup[] = [
    'dependencies',
    ...(useDev ? (['devDependencies'] as const) : []),
    ...options.include.map((flag) => INCLUDED_GROUPS[flag]),
  ];
  // Precedence: dependencies, dev, peer, optional; a name is checked once.
  const order: DependencyGroup[] = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ];
  const seen = new Set<string>();
  const results = order
    .filter((group) => groups.includes(group))
    .map((group) => {
      const names = Object.keys(pkg[group] ?? {}).filter((name) => !seen.has(name));

      names.forEach((name) => seen.add(name));

      return resolveDependencies(packageJsonPath, names, group);
    });
  const requirements = results.flatMap((r) => r.requirements);
  const skipped = results.flatMap((r) => r.skipped);
  const floor = requiredFloor(requirements.map((r) => r.range));
  const configuredFloor = configured === null ? null : floorOf(configured);
  const advisories =
    options.lts && configuredFloor && major(configuredFloor) < major(options.lts.maintainedLts)
      ? [
          `engines.node floor ${configuredFloor} is below the maintained LTS (v${major(options.lts.maintainedLts)})`,
        ]
      : [];
  const filled: WorkspaceBase = {
    ...base,
    configured,
    configuredFloor,
    floor,
    requirements,
    skipped,
    counts: { checked: requirements.length, skipped: skipped.length },
    advisories,
  };

  const why: Conflict['why'] = isExact ? 'not-in-range' : 'not-subset';
  const unsatisfiable = floor === null && requirements.length > 0;
  const conflicts: Conflict[] = requirements
    .filter(
      ({ range }) =>
        unsatisfiable ||
        (configured !== null &&
          !(isExact ? new Range(range).test(configured) : subset(configured, range)))
    )
    .map(({ name, group, range }) => ({
      dependency: name,
      group,
      range,
      why,
      dependencyFloor: floorOf(range),
    }));

  return conflicts.length > 0
    ? { ...filled, status: 'fail', reason: 'incompatible', conflicts }
    : { ...filled, status: 'pass' };
};
