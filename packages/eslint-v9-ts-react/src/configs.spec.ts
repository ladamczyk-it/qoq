import { REACT_ONLY_SONARJS_RULES } from '@ladamczyk/qoq-eslint-v9-js';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { baseConfig, configs } from './index';

import type { Linter } from 'eslint';

interface IResolvedConfig {
  rules: Record<string, [Linter.Severity, ...unknown[]]>;
  settings?: Record<string, unknown>;
  plugins?: Record<string, unknown>;
}

const resolveConfigForFile = async (
  overrideConfig: Linter.Config[],
  filePath: string
): Promise<IResolvedConfig> => {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig });

  return (await eslint.calculateConfigForFile(filePath)) as IResolvedConfig;
};

// The legacy merge drops `reactLayer`'s React-specific *options* on exactly these two
// rules: `objectMergeRight` lets the JS base's plain tuples (riding in with
// `tsBaseConfig`) overwrite them. `configs.base` never re-applies the JS base, so it
// keeps them — the diamond-extends bug this migration removes. Severities are equal on
// both, so these two compare on severity here and are asserted positively below. Do not
// extend this list: any other divergence is a real regression.
const SANCTIONED_OPTION_DELTAS = ['import-x/order', 'no-restricted-imports'];

// ESLint's cascade keeps an earlier entry's options when a later layer overrides
// severity only, while objectMergeRight replaced the whole tuple — options carry
// no meaning on a disabled rule, so those compare on severity alone.
const normalizeRules = (rules: IResolvedConfig['rules']): Record<string, unknown[]> =>
  Object.fromEntries(
    Object.entries(rules).map(([id, entry]) => [
      id,
      entry[0] === 0 || SANCTIONED_OPTION_DELTAS.includes(id) ? [entry[0]] : entry,
    ])
  );

// The templates ship without `files` scoping (the qoq CLI adds it from qoq.config.js),
// and ESLint only treats `.ts`/`.tsx` files as lintable once some config's `files`
// matches them — without this entry `calculateConfigForFile` returns undefined for
// both shapes.
const tsFilesScope: Linter.Config = { files: ['**/*.{ts,tsx}'] };

const resolveComposed = async (filePath: string): Promise<IResolvedConfig> =>
  resolveConfigForFile([...configs.base, tsFilesScope], filePath);

describe('defineConfig composition', () => {
  it.each(['src/example.tsx', 'src/example.ts'])(
    'resolves %s to the same effective config as the legacy merged baseConfig',
    async (filePath) => {
      const legacy = await resolveConfigForFile([baseConfig, tsFilesScope], filePath);
      const composed = await resolveComposed(filePath);

      expect(normalizeRules(composed.rules)).toStrictEqual(normalizeRules(legacy.rules));
      expect(composed.settings).toStrictEqual(legacy.settings);
      expect(Object.keys(composed.plugins ?? {}).sort()).toStrictEqual(
        Object.keys(legacy.plugins ?? {}).sort()
      );
    }
  );

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

  it('enables the custom no-multi-comp rule without the legacy re-assertion', async () => {
    const composed = await resolveComposed('src/example.tsx');

    expect(composed.rules['@eslint-react/no-multi-comp']).toStrictEqual([2]);
  });

  it('restores the react-only sonarjs rules without the legacy restoration hack', async () => {
    const composed = await resolveComposed('src/example.tsx');
    const isEnabled = Object.fromEntries(
      REACT_ONLY_SONARJS_RULES.map((rule) => [
        rule,
        (composed.rules[`sonarjs/${rule}`]?.[0] ?? 0) > 0,
      ])
    );

    expect(isEnabled).toStrictEqual({
      ...Object.fromEntries(REACT_ONLY_SONARJS_RULES.map((rule) => [rule, true])),
      // Duplicates `@eslint-react/set-state-in-render`, so `reactLayer` leaves it off.
      'no-hook-setter-in-body': false,
    });
  });
});
