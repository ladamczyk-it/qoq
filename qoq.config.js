import { getNoRestrictedImportsPaths } from '@ladamczyk/qoq-eslint-v9-js';

import { websiteEslint } from './qoq.website.js';

const rules = {
  'no-restricted-imports': [
    1,
    {
      paths: getNoRestrictedImportsPaths(),
    },
  ],
};

export default {
  stats: true,
  prettier: {
    sources: ['.'],
  },
  // The React template widens the derived format list to js/jsx/tsx; keep jscpd on the TypeScript it has always scanned.
  jscpd: {
    format: ['typescript'],
  },
  knip: {
    entry: './src/index.{js,ts}',
    project: './src/**/*.{js,ts}',
    ignore: [
      '**/bin.ts',
      '**/rolldown.config.js',
      'packages/cli/src/types.ts',
      'configs/eslint-v9/rolldown.config.js',
      // Spawned as a subprocess by scripts/config-diff.js (by path string, and copied into a
      // temporary worktree to run there), so nothing imports it and knip can't see the use.
      'scripts/config-diff.resolver.mjs',
      // Eval fixtures: code an agent reads, never code anything imports.
      'evals/fixtures/**',
      // The plugin's hooks module: Claude Code loads it through hooks/hooks.json and
      // provides 'claude-code' itself, so nothing here imports it or installs that.
      'hooks/**',
      'qoq.website.js',
      // imported by nothing until M3 Ticket 3.5's preset pages; remove then
      'website/src/components/ConfigInspector/**',
    ],
    workspaces: {
      website: { ignoreDependencies: ['@internal/docusaurus-theme-docusaurus-theme'] },
    },
    ignoreDependencies: [
      // build specific
      'rolldown',
      'dotenv',
      // this is subpackage specific
      'postcss',
      'pkg-types',
      '@eslint/compat',
      'jscpd',
      'prettier-plugin-sort-json',
      'browserslist',
      'stylelint-*',
      'eslint-plugin-import-x',
      '@typescript-eslint/utils',
      // imported by ConfigInspector, which nothing consumes until M3's preset pages; remove then
      '@docusaurus/theme-common',
    ],
  },
  eslint: [
    {
      template: 'qoq-eslint-v9-js',
      files: ['skills/**/*.{js,cjs,mjs}'],
    },
    {
      template: 'qoq-eslint-v9-ts',
      files: ['packages/**/src/**/*.ts'],
      ignores: ['**/*.spec.ts'],
      rules,
    },
    {
      template: 'qoq-eslint-v9-js',
      files: ['packages/**/src/**/*.js'],
      ignores: ['**/*.spec.js'],
      rules,
    },
    {
      template: 'qoq-eslint-v9-ts-vitest',
      files: ['packages/**/src/**/*.spec.ts'],
      ignores: [],
      rules,
    },
    ...websiteEslint,
  ],
  skillslint: {
    path: './skills',
  },
  justifyDisable: {
    severity: 'warn',
  },
  structurelint: {
    structureRoot: 'packages',
    rules: {
      any_file: { name: '*' },
      any_folder: { name: '*', children: [{ ruleId: 'any_file' }, { ruleId: 'any_folder' }] },
    },
    structure: [
      {
        name: '{kebab-case}',
        children: [
          {
            name: 'src',
            required: true,
            children: [{ ruleId: 'any_file' }, { ruleId: 'any_folder' }],
          },
          { name: 'AGENTS.md', required: true },
          { name: 'CLAUDE.md', required: true },
          { name: 'LICENSE', required: true },
          { name: 'README.md', required: true },
          { name: 'package.json', required: true },
          { ruleId: 'any_file' },
          { ruleId: 'any_folder' },
        ],
      },
    ],
  },
  future: {
    unstable_skill_docs: true,
    unstable_skill_diagrams: true,
  },
};
