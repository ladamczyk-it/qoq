import { dirname, relative, resolve } from 'node:path';

import { getPackageInfo } from '@ladamczyk/qoq-utils';
import { minVersion, Range, satisfies, subset, valid, validRange } from 'semver';

import { readJsonSync } from './readJson.ts';

import type {
  Conflict,
  DependencyGroup,
  DependencyRequirement,
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

export const checkEngine = (packageJsonPath: string): WorkspaceResult => {
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

  const dependencyNames = Object.keys(pkg.dependencies ?? {});
  const useDev = dependencyNames.length === 0;
  const { requirements, skipped } = resolveDependencies(
    packageJsonPath,
    useDev ? Object.keys(pkg.devDependencies ?? {}) : dependencyNames,
    useDev ? 'devDependencies' : 'dependencies'
  );
  const floor = requiredFloor(requirements.map((r) => r.range));
  const filled: WorkspaceBase = {
    ...base,
    configured,
    configuredFloor: configured === null ? null : floorOf(configured),
    floor,
    requirements,
    skipped,
    counts: { checked: requirements.length, skipped: skipped.length },
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
