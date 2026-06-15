import { resolve } from 'path';

import { getEnabledDeprecatedRules, getEnabledRuleNames } from '@ladamczyk/qoq-eslint-v9-js/stats';
import { describe, it, expect } from 'vitest';

import { baseConfig, createFolderStructure } from './index';

const STATS_DIR = resolve(__dirname, '..', 'stats');

describe('eslint config deprecation guard', () => {
  it('enables the folder-structure rule', () => {
    // Reads straight from `baseConfig`, so it also exercises `index.ts`.
    expect(getEnabledRuleNames(baseConfig)).toContain('project-structure/folder-structure');
  });

  it('does not enable any deprecated rules', () => {
    expect(getEnabledDeprecatedRules(baseConfig, STATS_DIR)).toEqual([]);
  });
});

describe('createFolderStructure', () => {
  it('roots the structure at `src` by default with `components`/`features` children', () => {
    const config = createFolderStructure();

    expect(config.structureRoot).toBe('src');
    expect(config.structure).toBeInstanceOf(Array);
    expect(config.structure).toContainEqual({ ruleId: 'components_folder' });
    expect(config.structure).toContainEqual({ ruleId: 'features_folder' });
  });

  it('forwards monorepo scoping options, overriding the default `src` root', () => {
    const config = createFolderStructure({
      projectRoot: '/repo/packages/ui',
      structureRoot: 'packages/ui/src',
    });

    expect(config.projectRoot).toBe('/repo/packages/ui');
    expect(config.structureRoot).toBe('packages/ui/src');
  });
});
