import { describe, expect, it } from 'vitest';

import { formatHuman } from './report.ts';

import type { SkippedDependency, WorkspaceResult } from './types.ts';

const base = (path: string) => ({
  path,
  packageJsonPath: `${path}/package.json`,
  configured: '>=22.22.2',
  configuredFloor: '22.22.2',
  floor: '22.22.2',
  requirements: [],
  skipped: [],
  counts: { checked: 12, skipped: 3 },
  advisories: [],
});

const pass = (path: string): WorkspaceResult => ({ ...base(path), status: 'pass' });

const incompatible = (floor: string | null): WorkspaceResult => ({
  ...base('packages/foo'),
  configured: '>=18',
  floor,
  status: 'fail',
  reason: 'incompatible',
  conflicts: [
    {
      dependency: 'left-pad',
      group: 'dependencies',
      range: '>=22.22.2',
      why: 'not-subset',
      dependencyFloor: '22.22.2',
    },
    {
      dependency: 'right-pad',
      group: 'dependencies',
      range: '^20.1.0',
      why: 'not-subset',
      dependencyFloor: '20.1.0',
    },
  ],
});

describe('formatHuman', () => {
  it('renders a passing result as one line with path, range and counts', () => {
    const out = formatHuman([pass('packages/foo')]);

    expect(out.trimEnd().split('\n')).toHaveLength(1);
    expect(out).toContain('packages/foo');
    expect(out).toContain('>=22.22.2');
    expect(out).toContain('12 checked');
    expect(out).toContain('3 skipped');
  });

  it('ends a passing report with exactly one newline', () => {
    const out = formatHuman([pass('packages/foo')]);

    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
  });

  it('ends an incompatible report with exactly one newline', () => {
    const out = formatHuman([incompatible('22.22.2')]);

    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
    expect(out.trimEnd().split('\n').at(-1)).toContain('required floor');
  });

  it('returns an empty string for no results', () => {
    expect(formatHuman([])).toBe('');
  });

  it('renders three passing workspaces as exactly three non-empty lines', () => {
    const lines = formatHuman([pass('a'), pass('b'), pass('c')])
      .split('\n')
      .filter((line) => line.trim() !== '');

    expect(lines).toHaveLength(3);
  });

  it('lists each conflict with name, range and floor, plus the required floor', () => {
    const out = formatHuman([incompatible('22.22.2')]);

    expect(out).toContain('left-pad');
    expect(out).toContain('>=22.22.2');
    expect(out).toContain('right-pad');
    expect(out).toContain('^20.1.0');
    const lines = out.split('\n');

    expect(lines.find((l) => l.includes('dependency'))).toMatch(/dependency\s+requires\s+floor$/);
    expect(lines.find((l) => l.includes('left-pad'))).toMatch(/>=22\.22\.2\s+22\.22\.2$/);
    expect(lines.find((l) => l.includes('right-pad'))).toMatch(/\^20\.1\.0\s+20\.1\.0$/);
    expect(out).toContain('required floor: 22.22.2');
  });

  it('renders required floor: none when floor is null', () => {
    expect(formatHuman([incompatible(null)])).toContain('required floor: none');
  });

  it.each(['invalid-engines', 'unreadable'] as const)(
    'renders path and message for %s',
    (reason) => {
      const out = formatHuman([
        { ...base('packages/bar'), status: 'fail', reason, message: `boom ${reason}` },
      ]);

      expect(out).toContain('packages/bar');
      expect(out).toContain(`boom ${reason}`);
    }
  );

  it('renders a malformed-range skip as a warning under its workspace', () => {
    const skipped: SkippedDependency = {
      name: 'weird-dep',
      group: 'dependencies',
      reason: 'malformed-range',
      range: '>=not-a-range',
    };
    const lines = formatHuman([{ ...pass('packages/foo'), skipped: [skipped] }]).split('\n');

    expect(lines[0]).toContain('packages/foo');
    expect(lines[1]).toContain('weird-dep');
    expect(lines[1]).toContain('>=not-a-range');
    expect(lines[1]).toContain('⚠');
  });

  it('renders a pass without engines.node as a prompt to add one', () => {
    const out = formatHuman([{ ...pass('packages/foo'), configured: null }]);

    expect(out).toContain('no engines.node configured');
  });

  it('prints neither the old banner nor the old typo', () => {
    const out = formatHuman([pass('a'), incompatible('22.22.2')]);

    expect(out).not.toContain('CHECK ENGINE');
    expect(out).not.toContain('criteria!.');
  });
});
