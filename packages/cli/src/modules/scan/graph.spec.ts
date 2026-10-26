import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { formatGraph, traceVia } from './graph.ts';

import type { IScanFinding } from './types.ts';

const finding = (pkg: string, version: string, id = 'A'): IScanFinding => ({
  package: pkg,
  version,
  id,
  severity: 'high',
});

let dir = '';

afterEach(() => rmSync(dir, { recursive: true, force: true }));

const lock = (packages: Record<string, unknown>): string => {
  dir = mkdtempSync(join(tmpdir(), 'qoq-graph-'));
  const path = join(dir, 'package-lock.json');
  writeFileSync(path, JSON.stringify({ lockfileVersion: 3, packages }));
  return path;
};

describe('formatGraph', () => {
  it('walks every path up to the declaring manifests, deduping and resolving nested copies', () => {
    const path = lock({
      '': { devDependencies: { tool: '1' }, workspaces: ['packages/app'] },
      'packages/app': { name: 'app', dependencies: { lib: '1', vuln: '1' } },
      'node_modules/app': { resolved: 'packages/app', link: true },
      'node_modules/tool': { version: '1.0.0', dependencies: { lib: '1' } },
      'node_modules/lib': { version: '1.0.0', dependencies: { vuln: '1' } },
      'node_modules/vuln': { version: '1.0.0' },
      // a nested copy shadows the hoisted one for its parent only
      'node_modules/lib/node_modules/vuln': { version: '2.0.0' },
    });

    expect(formatGraph(path, [finding('vuln', '2.0.0', 'A'), finding('vuln', '2.0.0', 'B')]))
      .toBe(`vuln@2.0.0  (2 advisories, high)
└─ lib@1.0.0
   ├─ packages/app/package.json (dependencies)
   └─ tool@1.0.0
      └─ package.json (devDependencies)
`);
    expect(formatGraph(path, [finding('vuln', '1.0.0')])).toBe(`vuln@1.0.0  (1 advisory, high)
└─ packages/app/package.json (dependencies)
`);
  });

  it('marks repeats and cycles instead of expanding them again', () => {
    const path = lock({
      '': { dependencies: { a: '1', b: '1' } },
      'node_modules/a': { version: '1.0.0', dependencies: { b: '1', vuln: '1' } },
      'node_modules/b': { version: '1.0.0', dependencies: { a: '1', vuln: '1' } },
      'node_modules/vuln': { name: 'vuln', version: '1.0.0' },
    });

    expect(formatGraph(path, [finding('vuln', '1.0.0')])).toBe(`vuln@1.0.0  (1 advisory, high)
├─ a@1.0.0
│  ├─ package.json (dependencies)
│  └─ b@1.0.0
│     ├─ package.json (dependencies)
│     └─ a@1.0.0 (cycle)
└─ b@1.0.0 (see above)
`);
  });
});

describe('traceVia', () => {
  it('names the manifest, direct dependency and requiring parent per copy', () => {
    const via = traceVia(
      lock({
        '': { devDependencies: { tool: '1' }, workspaces: ['packages/app'] },
        'packages/app': { name: 'app', dependencies: { lib: '1', vuln: '1' } },
        'node_modules/app': { resolved: 'packages/app', link: true },
        'node_modules/tool': { version: '1.0.0', dependencies: { lib: '1' } },
        'node_modules/lib': { version: '1.0.0', dependencies: { vuln: '1' } },
        'node_modules/vuln': { version: '1.0.0' },
        'node_modules/lib/node_modules/vuln': { version: '2.0.0' },
      })
    );

    expect(via('vuln', '2.0.0')).toStrictEqual([
      { manifest: 'package.json', direct: 'tool', parent: 'lib' },
      { manifest: 'packages/app/package.json', direct: 'lib', parent: 'lib' },
    ]);
    expect(via('vuln', '1.0.0')).toStrictEqual([
      { manifest: 'packages/app/package.json', direct: 'vuln' },
    ]);
  });

  it('collapses repeated paths and terminates on cycles', () => {
    const via = traceVia(
      lock({
        '': { dependencies: { a: '1', b: '1' } },
        'node_modules/a': { version: '1.0.0', dependencies: { b: '1', vuln: '1' } },
        'node_modules/b': { version: '1.0.0', dependencies: { a: '1', vuln: '1' } },
        'node_modules/vuln': { name: 'vuln', version: '1.0.0' },
      })
    );

    expect(via('vuln', '1.0.0')).toStrictEqual([
      { manifest: 'package.json', direct: 'a', parent: 'a' },
      { manifest: 'package.json', direct: 'a', parent: 'b' },
      { manifest: 'package.json', direct: 'b', parent: 'a' },
      { manifest: 'package.json', direct: 'b', parent: 'b' },
    ]);
  });

  it('returns nothing for a package the lockfile does not install', () => {
    expect(traceVia(lock({ '': {} }))('ghost', '1.0.0')).toStrictEqual([]);
  });
});
