import c from 'picocolors';

import type { Conflict, WorkspaceResult } from './types.ts';

const COLUMNS = ['dependency', 'requires', 'floor'] as const;

const conflictTable = (conflicts: readonly Conflict[]): string[] => {
  const rows = [
    [...COLUMNS],
    ...conflicts.map((x) => [x.dependency, x.range, x.dependencyFloor ?? 'none']),
  ];
  const widths = COLUMNS.map((_, i) => Math.max(...rows.map((row) => row[i]!.length)));

  return rows.map((row) =>
    `  ${row.map((cell, i) => cell.padEnd(widths[i]!)).join('  ')}`.trimEnd()
  );
};

const formatOne = (result: WorkspaceResult): string[] => {
  const { path, configured, counts } = result;
  const summary = `(${counts.checked} checked, ${counts.skipped} skipped)`;
  const warnings = result.skipped
    .filter((skip) => skip.reason === 'malformed-range')
    .map((skip) =>
      c.yellow(`  ⚠ ${skip.name} has a malformed engines.node range "${skip.range}" (skipped)`)
    );
  const advisories = result.advisories.map((advisory) => c.yellow(`  ⚠ ${advisory}`));

  if (result.status === 'pass') {
    const head =
      configured === null
        ? c.yellow(`✔ ${path}  no engines.node configured — add one`)
        : c.green(`✔ ${path}  ${configured}  ${summary}`);

    return [head, ...warnings, ...advisories];
  }

  if (result.reason !== 'incompatible') {
    return [c.red(`✖ ${path}  ${result.message}`), ...warnings, ...advisories];
  }

  const floor = result.floor ?? 'none — dependency ranges are mutually unsatisfiable';

  return [
    c.red(`✖ ${path}  ${configured ?? ''}  ${summary}`),
    ...conflictTable(result.conflicts),
    `  required floor: ${floor}`,
    ...warnings,
    ...advisories,
  ];
};

export const formatHuman = (results: readonly WorkspaceResult[]): string =>
  results
    .flatMap(formatOne)
    .map((line) => `${line}\n`)
    .join('');
