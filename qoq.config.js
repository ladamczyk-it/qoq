import { getNoRestrictedImportsPaths } from '@ladamczyk/qoq-eslint-v9-js';

const rules = {
  'no-restricted-imports': [
    1,
    {
      paths: getNoRestrictedImportsPaths(),
    },
  ],
};

export default {
  prettier: {
    sources: ['.'],
  },
  jscpd: {
    threshold: 3,
  },
  knip: {
    entry: './src/index.{js,ts}',
    project: './src/**/*.{js,ts}',
    ignore: ['**/bin.ts', '**/rollup.*.js', 'packages/cli/src/types.ts'],
    ignoreDependencies: [
      // build specific
      '@rollup/*',
      'rollup-*',
      'esbuild',
      'dotenv',
      // this is subpackage specific
      'postcss',
      'pkg-types',
      '@eslint/compat',
      '@jscpd/core',
      'jscpd',
      'prettier-plugin-sort-json',
      'browserslist',
      'stylelint-*',
      'eslint-plugin-import-x',
      '@typescript-eslint/utils',
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
    {
      template: 'qoq-eslint-v9-js-vitest',
      files: ['packages/**/src/**/*.spec.js'],
      ignores: [],
      rules,
    },
  ],
  skillslint: {
    path: './skills',
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
};
