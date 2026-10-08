import { globSync } from 'node:fs';

import type { PackageJson } from 'type-fest';

const ROOT = './package.json';
const GLOB_CHARS = /[*?[\]{}()]/;

const trimSlashes = (pattern: string): string =>
  (pattern.startsWith('./') ? pattern.slice(2) : pattern).replace(/\/$/, '');

export const findWorkspaces = (cwd: string, workspaces: PackageJson['workspaces']): string[] => {
  const patterns = (Array.isArray(workspaces) ? workspaces : (workspaces?.packages ?? [])).map(
    trimSlashes
  );
  const exclude = [
    '**/node_modules/**',
    ...patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1)),
  ];
  const found = new Set<string>();

  for (const pattern of patterns.filter((entry) => !entry.startsWith('!'))) {
    if (GLOB_CHARS.test(pattern)) {
      for (const match of globSync(`${pattern}/package.json`, { cwd, exclude })) {
        found.add(match);
      }
    } else {
      // Literal path: returned even if missing, so checkEngine reports it unreadable.
      found.add(`${pattern}/package.json`);
    }
  }

  return [ROOT, ...[...found].sort()];
};
