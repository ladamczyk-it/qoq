import { EslintConfig } from '@ladamczyk/qoq-eslint-v9-js';
import {
  createFolderStructure as createProjectFolderStructure,
  type FolderStructureConfig,
  projectStructureParser,
  projectStructurePlugin,
} from 'eslint-plugin-project-structure';

/** Every `ruleId` referenced within the structure. */
export type TRuleId =
  | 'module_file'
  | 'module_subfolder'
  | 'components_folder'
  | 'component_folder'
  | 'leaf_component_folder'
  | 'features_folder'
  | 'feature_folder'
  | 'helpers_folder';

/** A single reusable folder-structure rule, as referenced by `{ ruleId }`. */
export type TFolderRule = NonNullable<FolderStructureConfig<TRuleId>['rules']>[TRuleId];

// A camelCase module file, e.g. `mainConfig.ts`, `useUserStore.ts`, `fetch.ts`.
export const moduleFileRule: TFolderRule = { name: '{camelCase}.(ts|tsx)' };

// A camelCase grouping sub-folder, e.g. `helpers/zod`, `services/openapi`.
export const moduleSubfolderRule: TFolderRule = {
  name: '{camelCase}',
  folderRecursionLimit: 3,
  children: [{ ruleId: 'module_subfolder' }, { ruleId: 'module_file' }],
};

// A `components` directory: PascalCase component folders or flat PascalCase files.
export const componentsFolderRule: TFolderRule = {
  name: 'components',
  children: [{ ruleId: 'component_folder' }, { name: '{PascalCase}.(tsx|ts)' }],
};

// A single PascalCase component directory (recursive via `components/`).
export const componentFolderRule: TFolderRule = {
  name: '{PascalCase}',
  folderRecursionLimit: 3,
  children: [
    { name: 'index.ts' },
    { name: '{PascalCase}.(tsx|ts)' },
    { name: '{PascalCase}.spec.(tsx|ts)' },
    { name: '{PascalCase}.css' },
    // Nested components: grouped under `components/`, or a single
    // directly-placed leaf component (kept non-recursive for performance).
    { ruleId: 'components_folder' },
    { ruleId: 'leaf_component_folder' },
    { ruleId: 'helpers_folder' },
  ],
};

// A directly-nested PascalCase component that does not itself nest further
// components. Deliberately not recursive, so it adds no cycle (and no cost).
export const leafComponentFolderRule: TFolderRule = {
  name: '{PascalCase}',
  children: [
    { name: 'index.ts' },
    { name: '{PascalCase}.(tsx|ts)' },
    { name: '{PascalCase}.spec.(tsx|ts)' },
    { name: '{PascalCase}.css' },
    { ruleId: 'helpers_folder' },
  ],
};

// A `features` directory: PascalCase feature folders.
export const featuresFolderRule: TFolderRule = {
  name: 'features',
  children: [{ ruleId: 'feature_folder' }],
};

// A single PascalCase feature directory (recursive via nested `features`).
export const featureFolderRule: TFolderRule = {
  name: '{PascalCase}',
  folderRecursionLimit: 3,
  children: [
    { name: 'index.ts' },
    { name: 'types.ts' },
    { name: '{PascalCase}.(tsx|ts)' },
    { name: '{PascalCase}.spec.(tsx|ts)' },
    { ruleId: 'components_folder' },
    { ruleId: 'helpers_folder' },
    { ruleId: 'features_folder' },
  ],
};

// A `helpers` directory: camelCase modules and specs, PascalCase
// providers/errors, and camelCase grouping sub-folders.
export const helpersFolderRule: TFolderRule = {
  name: 'helpers',
  children: [
    { name: '{camelCase}.(ts|tsx)' },
    { name: '{camelCase}.spec.(ts|tsx)' },
    { name: '{PascalCase}.(ts|tsx)' },
    { ruleId: 'module_subfolder' },
  ],
};

/** The reusable rules, keyed by the `ruleId` they are referenced under. */
const rules: Record<TRuleId, TFolderRule> = {
  module_file: moduleFileRule,
  module_subfolder: moduleSubfolderRule,
  components_folder: componentsFolderRule,
  component_folder: componentFolderRule,
  leaf_component_folder: leafComponentFolderRule,
  features_folder: featuresFolderRule,
  feature_folder: featureFolderRule,
  helpers_folder: helpersFolderRule,
};

/**
 * Builds the `project-structure/folder-structure` rule options for a TS + React
 * project: `components/`, `features/`, `helpers/`, `config/`, `store/`,
 * `services/`, rooted at `src/` by default.
 *
 * Exported on its own (not only baked into {@link baseConfig}) because the same
 * structure may describe a single package inside a monorepo as well as a single
 * standalone app. The structure lives under `src/` by default (`structureRoot`);
 * in a monorepo, override `structureRoot`/`projectRoot` to scope it to the
 * package folder (e.g. `packages/ui/src`), or merge extra `ignorePatterns`.
 */
export const createFolderStructure = (
  options: Pick<FolderStructureConfig, 'structureRoot' | 'projectRoot' | 'ignorePatterns'> = {}
): FolderStructureConfig =>
  createProjectFolderStructure({
    // The structure is rooted at `src/`; everything outside it is left untouched.
    // Override for a monorepo package, e.g. `structureRoot: 'packages/ui/src'`.
    structureRoot: 'src',
    // Root-level entry files inside `src/` are left untouched: `App.tsx`,
    // `index.tsx`, `setupTests.ts`, and any `*.d.ts`.
    ignorePatterns: ['**/*.d.ts', '*.ts', '*.tsx'],
    // `structureRoot` (`src`) maps to the root rule; the entries below are its
    // only validated children (anything else directly in `src` is left untouched).
    structure: [
      { ruleId: 'components_folder' },
      { ruleId: 'features_folder' },
      { ruleId: 'helpers_folder' },
      {
        name: 'config',
        children: [{ ruleId: 'module_subfolder' }, { ruleId: 'module_file' }],
      },
      {
        name: 'store',
        children: [{ ruleId: 'module_subfolder' }, { ruleId: 'module_file' }],
      },
      {
        name: 'services',
        children: [{ ruleId: 'module_subfolder' }, { ruleId: 'module_file' }],
      },
    ],
    rules,
    ...options,
  });

export const baseConfig: EslintConfig = {
  name: 'qoq-eslint-v9-ts-react-structure',
  plugins: {
    'project-structure': projectStructurePlugin,
  },
  languageOptions: {
    parser: projectStructureParser,
  },
  rules: {
    'project-structure/folder-structure': [2, createFolderStructure()],
  },
};
