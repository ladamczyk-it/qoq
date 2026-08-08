import { resolve } from 'path';

import { getEnabledDeprecatedRules, getEnabledRuleNames } from '@ladamczyk/qoq-eslint-v9-js/stats';
import { ESLint } from 'eslint';
import { describe, it, expect } from 'vitest';

import { configs } from './index';

import type { Linter } from 'eslint';

const STATS_DIR = resolve(__dirname, '..', 'stats');

interface IResolvedConfig {
  rules: Record<string, [Linter.Severity, ...unknown[]]>;
}

const resolveConfigForFile = async (
  overrideConfig: Linter.Config[],
  filePath: string
): Promise<IResolvedConfig> => {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig });

  return (await eslint.calculateConfigForFile(filePath)) as IResolvedConfig;
};

// The templates ship without `files` scoping (the qoq CLI adds it from qoq.config.js),
// and ESLint only treats `.ts`/`.tsx` files as lintable once some config's `files`
// matches them — without this entry `calculateConfigForFile` returns undefined.
const tsFilesScope: Linter.Config = { files: ['**/*.{ts,tsx}'] };

const resolveComposed = async (filePath: string): Promise<IResolvedConfig> =>
  resolveConfigForFile([...configs.base, tsFilesScope], filePath);

describe('eslint config deprecation guard', () => {
  it('resolves the rules the package config enables', () => {
    // Reads straight from `configs.base`, so it also exercises `index.ts`.
    expect(getEnabledRuleNames(configs.base)).toContain('eqeqeq');
  });

  it('does not enable any deprecated rules', () => {
    expect(getEnabledDeprecatedRules(configs.base, STATS_DIR)).toStrictEqual([]);
  });

  // These two guard a deliberate behavior change: the legacy pre-merged `baseConfig`
  // had a diamond-extends bug that silently dropped `reactLayer`'s options for these
  // rules, while `configs.base`'s cascade composition keeps them. Deleting these would
  // silently un-cover that fix.
  it('keeps the react* import path group the legacy merge dropped', async () => {
    const composed = await resolveComposed('src/example.tsx');

    expect(composed.rules['import-x/order']).toStrictEqual([
      1,
      expect.objectContaining({
        pathGroups: [{ pattern: 'react*', group: 'builtin', position: 'before' }],
        pathGroupsExcludedImportTypes: ['react*'],
      }),
    ]);
  });

  it('keeps the lodash debounce restrictions the legacy merge dropped', async () => {
    const composed = await resolveComposed('src/example.tsx');
    const [severity, options] = composed.rules['no-restricted-imports'] ?? [];

    expect(severity).toBe(1);
    expect(options).toStrictEqual(
      expect.objectContaining({
        paths: expect.arrayContaining([
          expect.objectContaining({ name: 'lodash/debounce' }),
          expect.objectContaining({ name: 'lodash/fp/debounce' }),
        ]),
      })
    );
  });
});
