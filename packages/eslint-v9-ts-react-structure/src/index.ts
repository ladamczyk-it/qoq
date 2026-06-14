import { EslintConfig } from '@ladamczyk/qoq-eslint-v9-js';
import {
  createFolderStructure,
  projectStructureParser,
  projectStructurePlugin,
} from 'eslint-plugin-project-structure';

export const baseConfig: EslintConfig = {
  name: 'qoq-eslint-v9-ts-react-structure',
  plugins: {
    'project-structure': projectStructurePlugin,
  },
  languageOptions: {
    parser: projectStructureParser,
  },
  rules: {
    'project-structure/folder-structure': [
      2,
      createFolderStructure({
        ignorePatterns: ['**/*.d.ts', 'src/*.ts', 'src/*.tsx'],
        // The root rule maps to the project root; `src` is its only validated child
        // (everything else at the project root is left untouched).
        structure: [
          {
            name: 'src',
            children: [
              { ruleId: 'components_folder' },
              { ruleId: 'domains_folder' },
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
          },
        ],
        rules: {
          // A camelCase module file, e.g. `mainConfig.ts`, `useUserStore.ts`, `fetch.ts`.
          module_file: { name: '{camelCase}.(ts|tsx)' },
          // A camelCase grouping sub-folder, e.g. `helpers/zod`, `services/openapi`.
          module_subfolder: {
            name: '{camelCase}',
            folderRecursionLimit: 3,
            children: [{ ruleId: 'module_subfolder' }, { ruleId: 'module_file' }],
          },

          // A `components` directory: PascalCase component folders or flat PascalCase files.
          components_folder: {
            name: 'components',
            children: [{ ruleId: 'component_folder' }, { name: '{PascalCase}.(tsx|ts)' }],
          },
          // A single PascalCase component directory (recursive via `components/`).
          component_folder: {
            name: '{PascalCase}',
            folderRecursionLimit: 3,
            children: [
              { name: 'index.ts' },
              { name: '{PascalCase}.(tsx|ts)' },
              { name: '{PascalCase}.spec.tsx' },
              { name: '{PascalCase}.css' },
              // Nested components: grouped under `components/`, or a single
              // directly-placed leaf component (kept non-recursive for performance).
              { ruleId: 'components_folder' },
              { ruleId: 'leaf_component_folder' },
              { ruleId: 'helpers_folder' },
            ],
          },
          // A directly-nested PascalCase component that does not itself nest further
          // components. Deliberately not recursive, so it adds no cycle (and no cost).
          leaf_component_folder: {
            name: '{PascalCase}',
            children: [
              { name: 'index.ts' },
              { name: '{PascalCase}.(tsx|ts)' },
              { name: '{PascalCase}.spec.tsx' },
              { name: '{PascalCase}.css' },
              { ruleId: 'helpers_folder' },
            ],
          },

          // Top-level `features` directory: lowercase domain folders.
          domains_folder: {
            name: 'features',
            children: [{ ruleId: 'domain_folder' }],
          },
          // A camelCase domain folder, e.g. `ams`, `vms`, `general`, `login`.
          domain_folder: {
            name: '{camelCase}',
            children: [{ ruleId: 'features_folder' }, { ruleId: 'helpers_folder' }],
          },
          // A nested `features` directory: PascalCase feature folders.
          features_folder: {
            name: 'features',
            children: [{ ruleId: 'feature_folder' }],
          },
          // A single PascalCase feature directory (recursive via nested `features`).
          feature_folder: {
            name: '{PascalCase}',
            folderRecursionLimit: 3,
            children: [
              { name: 'index.ts' },
              { name: 'types.ts' },
              { name: '{PascalCase}.(tsx|ts)' },
              { name: '{PascalCase}.spec.tsx' },
              { ruleId: 'components_folder' },
              { ruleId: 'helpers_folder' },
              { ruleId: 'features_folder' },
            ],
          },

          // A `helpers` directory: camelCase modules, PascalCase providers/errors,
          // and camelCase grouping sub-folders.
          helpers_folder: {
            name: 'helpers',
            children: [
              { name: '{camelCase}.(ts|tsx)' },
              { name: '{PascalCase}.(ts|tsx)' },
              { ruleId: 'module_subfolder' },
            ],
          },
        },
      }),
    ],
  },
};
