import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { baseConfig, configs, strictConfig, testConfig } from './index';

import type { Linter } from 'eslint';

interface IResolvedConfig {
  rules: Record<string, [Linter.Severity, ...unknown[]]>;
  settings?: Record<string, unknown>;
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
// and ESLint only treats `.ts` files as lintable once some config's `files` matches
// them — without this entry `calculateConfigForFile` returns undefined for both shapes.
const tsFilesScope: Linter.Config = { files: ['**/*.ts'] };

const resolvePair = async (
  legacyConfig: Linter.Config,
  composedConfigs: Linter.Config[]
): Promise<{ legacy: IResolvedConfig; composed: IResolvedConfig }> => ({
  legacy: await resolveConfigForFile([legacyConfig, tsFilesScope], 'src/example.ts'),
  composed: await resolveConfigForFile([...composedConfigs, tsFilesScope], 'src/example.ts'),
});

describe('defineConfig composition', () => {
  it('configs.base matches the legacy merged baseConfig', async () => {
    const { legacy, composed } = await resolvePair(baseConfig, configs.base);

    expect(normalizeRules(composed.rules)).toStrictEqual(normalizeRules(legacy.rules));
    expect(composed.settings).toStrictEqual(legacy.settings);
  });

  it('configs.test matches the legacy merged testConfig', async () => {
    const { legacy, composed } = await resolvePair(testConfig, configs.test);

    expect(normalizeRules(composed.rules)).toStrictEqual(normalizeRules(legacy.rules));
    expect(composed.settings).toStrictEqual(legacy.settings);
  });

  it('configs.strict matches the legacy merged strictConfig', async () => {
    const { legacy, composed } = await resolvePair(strictConfig, configs.strict);

    expect(normalizeRules(composed.rules)).toStrictEqual(normalizeRules(legacy.rules));
    expect(composed.settings).toStrictEqual(legacy.settings);
  });
});
