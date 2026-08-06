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

// ESLint's cascade keeps an earlier entry's options when a later layer overrides
// severity only, while objectMergeRight replaced the whole tuple — options carry
// no meaning on a disabled rule, so those compare on severity alone.
const normalizeRules = (rules: IResolvedConfig['rules']): Record<string, unknown[]> =>
  Object.fromEntries(
    Object.entries(rules).map(([id, entry]) => [id, entry[0] === 0 ? [0] : entry])
  );

// The templates ship without `files` scoping (the qoq CLI adds it from qoq.config.js),
// and ESLint only treats `.jsx` files as lintable once some config's `files` matches
// them — without this entry `calculateConfigForFile` returns undefined for both shapes.
const jsFilesScope: Linter.Config = { files: ['**/*.{js,jsx,mjs,cjs}'] };

describe('defineConfig composition', () => {
  it.each(['src/example.jsx', 'src/example.js'])(
    'resolves %s to the same effective config as the legacy merged baseConfig',
    async (filePath) => {
      const legacy = await resolveConfigForFile([baseConfig, jsFilesScope], filePath);
      const composed = await resolveConfigForFile([...configs.base, jsFilesScope], filePath);

      expect(normalizeRules(composed.rules)).toStrictEqual(normalizeRules(legacy.rules));
      expect(composed.settings).toStrictEqual(legacy.settings);
      expect(Object.keys(composed.plugins ?? {}).sort()).toStrictEqual(
        Object.keys(legacy.plugins ?? {}).sort()
      );
    }
  );
});
