import { describe, it, expect } from 'vitest';

import { jsConfig, jsReactConfig, tsConfig, tsReactConfig } from './index';

describe('preset configs', () => {
  it('jsConfig should use the JavaScript defaults', () => {
    expect(jsConfig).toStrictEqual({
      entry: ['.src/index.js'],
      project: ['.src/**/*.js'],
      ignore: ['package.json'],
      ignoreDependencies: [],
      ignoreBinaries: [],
      ignoreFiles: [],
      ignoreMembers: [],
      ignoreUnresolved: [],
    });
  });

  it('jsReactConfig should include jsx sources', () => {
    expect(jsReactConfig).toStrictEqual({
      entry: ['.src/index.jsx'],
      project: ['.src/**/*.{js,jsx}'],
      ignore: ['package.json'],
      ignoreDependencies: [],
      ignoreBinaries: [],
      ignoreFiles: [],
      ignoreMembers: [],
      ignoreUnresolved: [],
    });
  });

  it('tsConfig should target TypeScript sources and ignore generated files', () => {
    expect(tsConfig).toStrictEqual({
      entry: ['.src/index.ts'],
      project: ['.src/**/*.{js,ts}'],
      ignore: ['package.json', 'tsconfig.json', '**/*.d.ts'],
      ignoreDependencies: [],
      ignoreBinaries: [],
      ignoreFiles: [],
      ignoreMembers: [],
      ignoreUnresolved: [],
    });
  });

  it('tsReactConfig should include tsx sources and ignore generated files', () => {
    expect(tsReactConfig).toStrictEqual({
      entry: ['.src/index.tsx'],
      project: ['.src/**/*.{js,jsx,ts,tsx}'],
      ignore: ['package.json', 'tsconfig.json', '**/*.d.ts'],
      ignoreDependencies: [],
      ignoreBinaries: [],
      ignoreFiles: [],
      ignoreMembers: [],
      ignoreUnresolved: [],
    });
  });
});
