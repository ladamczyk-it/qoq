import { existsSync, readFileSync } from 'fs';

import type { IScanDependency } from './types.ts';

export type TReadDependencies =
  | { ok: true; dependencies: IScanDependency[]; excludedPrivate: number }
  | { ok: false; reason: string };

interface ILockEntry {
  name?: string;
  version?: string;
  resolved?: string;
  link?: boolean;
  dev?: boolean;
}

const REGISTRY = 'https://registry.npmjs.org/';
const PREFIX = 'node_modules/';

const unsupported = (version: unknown): TReadDependencies => ({
  ok: false,
  reason: `unsupported package-lock.json (lockfileVersion ${typeof version === 'number' ? version : 'unknown'})`,
});

export const readDependencies = (lockfilePath: string, production: boolean): TReadDependencies => {
  if (!existsSync(lockfilePath)) {
    return { ok: false, reason: 'no package-lock.json' };
  }

  let lock: { lockfileVersion?: unknown; packages?: Record<string, ILockEntry> };
  try {
    lock = JSON.parse(readFileSync(lockfilePath, 'utf8'));
  } catch {
    return unsupported(undefined);
  }
  const { lockfileVersion, packages } = lock ?? {};
  if (
    typeof lockfileVersion !== 'number' ||
    lockfileVersion < 2 ||
    !packages ||
    typeof packages !== 'object'
  ) {
    return unsupported(lockfileVersion);
  }

  const deduped = new Map<string, IScanDependency>();
  let excludedPrivate = 0;

  for (const [key, entry] of Object.entries(packages)) {
    if (!key.includes(PREFIX) || !entry || entry.link === true || !entry.version) {
      continue;
    }
    if (typeof entry.resolved !== 'string' || !entry.resolved.startsWith(REGISTRY)) {
      excludedPrivate++;
      continue;
    }
    const name = entry.name ?? key.slice(key.lastIndexOf(PREFIX) + PREFIX.length);
    const { version } = entry;
    const id = `${name}@${version}`;
    const dev = entry.dev === true;
    const seen = deduped.get(id);
    if (seen) {
      seen.dev &&= dev;
    } else {
      deduped.set(id, { name, version, dev });
    }
  }

  const dependencies = [...deduped.values()].filter((dep) => !(production && dep.dev));
  return { ok: true, dependencies, excludedPrivate };
};
