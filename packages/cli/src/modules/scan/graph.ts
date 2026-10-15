import { readFileSync } from 'fs';

import type { IScanFinding } from './types.ts';

interface ILockEntry {
  name?: string;
  version?: string;
  resolved?: string;
  link?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

type TPackages = Record<string, ILockEntry>;

const PREFIX = 'node_modules/';
const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

// Lockfile keys without node_modules/ are manifests: '' is the root, the rest are workspaces.
const isManifest = (key: string): boolean => !key.includes(PREFIX);

const nameOf = (key: string): string => key.slice(key.lastIndexOf(PREFIX) + PREFIX.length);

// Node's lookup: <dir>/node_modules/<dep>, then each enclosing node_modules up to the root.
const resolve = (packages: TPackages, from: string, dep: string): string | undefined => {
  for (let dir = from; ;) {
    const key = dir ? `${dir}/${PREFIX}${dep}` : `${PREFIX}${dep}`;
    const entry = packages[key];
    if (entry) {
      return entry.link ? entry.resolved : key;
    }
    if (!dir) {
      return undefined;
    }
    const up = dir.lastIndexOf(`/${PREFIX}`);
    dir = up >= 0 ? dir.slice(0, up) : '';
  }
};

interface IEdge {
  from: string;
  field: (typeof DEP_FIELDS)[number];
}

const dependents = (packages: TPackages): Map<string, IEdge[]> => {
  const parents = new Map<string, IEdge[]>();
  for (const [from, entry] of Object.entries(packages)) {
    if (entry.link) {
      continue;
    }
    for (const field of DEP_FIELDS) {
      for (const dep of Object.keys(entry[field] ?? {})) {
        const to = resolve(packages, from, dep);
        if (to !== undefined && packages[to]) {
          parents.set(to, [...(parents.get(to) ?? []), { from, field }]);
        }
      }
    }
  }
  return parents;
};

// Each vulnerable name@version as an inverted tree, walked up to the manifests that
// declare it. A package expanded once is printed `(see above)` after, as npm ls dedupes.
export const formatGraph = (lockfilePath: string, findings: IScanFinding[]): string => {
  const { packages = {} } = JSON.parse(readFileSync(lockfilePath, 'utf8')) as {
    packages?: TPackages;
  };
  const parents = dependents(packages);
  const realName = (key: string): string => packages[key]?.name ?? nameOf(key);
  const label = (key: string): string => `${realName(key)}@${packages[key]?.version ?? '?'}`;
  const manifest = (key: string): string => (key ? `${key}/package.json` : 'package.json');
  const out: string[] = [];

  const walk = (key: string, indent: string, path: Set<string>, seen: Set<string>): void => {
    const edges = parents.get(key) ?? [];
    edges.forEach(({ from, field }, i) => {
      const last = i === edges.length - 1;
      const branch = `${indent}${last ? '└─ ' : '├─ '}`;
      const next = `${indent}${last ? '   ' : '│  '}`;
      if (isManifest(from)) {
        out.push(`${branch}${manifest(from)} (${field})`);
      } else if (path.has(from)) {
        out.push(`${branch}${label(from)} (cycle)`);
      } else if (seen.has(from)) {
        out.push(`${branch}${label(from)} (see above)`);
      } else {
        seen.add(from);
        out.push(`${branch}${label(from)}`);
        walk(from, next, new Set(path).add(from), seen);
      }
    });
  };

  // Findings arrive sorted by severity, so a group's first finding carries its worst.
  const groups = new Map<string, IScanFinding[]>();
  for (const f of findings) {
    const id = `${f.package}@${f.version}`;
    groups.set(id, [...(groups.get(id) ?? []), f]);
  }
  for (const [id, group] of groups) {
    const [{ package: name, version, severity }] = group as [IScanFinding];
    const count = `${group.length} ${group.length === 1 ? 'advisory' : 'advisories'}`;
    out.push(`${id}  (${count}, ${severity})`);
    const seen = new Set<string>();
    for (const key of Object.keys(packages)) {
      if (!isManifest(key) && realName(key) === name && packages[key]?.version === version) {
        walk(key, '', new Set([key]), seen);
      }
    }
    out.push('');
  }
  return out.join('\n');
};
