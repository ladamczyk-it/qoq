import { describe, it, expect } from 'vitest';

import { jsConfig, jsReactConfig, tsConfig, tsReactConfig } from './index';

describe('preset configs', () => {
  it('jsConfig should use the JavaScript defaults', () => {
    expect(jsConfig).toEqual({
      entry: ['.src/index.js'],
      project: ['.src/**/*.js'],
      ignore: ['package.json'],
      ignoreDependencies: [],
      ignoreBinaries: [],
    });
  });

  it('jsReactConfig should include jsx sources', () => {
    expect(jsReactConfig).toEqual({
      entry: ['.src/index.jsx'],
      project: ['.src/**/*.{js,jsx}'],
      ignore: ['package.json'],
      ignoreDependencies: [],
      ignoreBinaries: [],
    });
  });

  it('tsConfig should target TypeScript sources and ignore generated files', () => {
    expect(tsConfig).toEqual({
      entry: ['.src/index.ts'],
      project: ['.src/**/*.{js,ts}'],
      ignore: ['package.json', 'tsconfig.json', '**/*.d.ts'],
      ignoreDependencies: [],
      ignoreBinaries: [],
    });
  });

  it('tsReactConfig should include tsx sources and ignore generated files', () => {
    expect(tsReactConfig).toEqual({
      entry: ['.src/index.tsx'],
      project: ['.src/**/*.{js,jsx,ts,tsx}'],
      ignore: ['package.json', 'tsconfig.json', '**/*.d.ts'],
      ignoreDependencies: [],
      ignoreBinaries: [],
    });
  });
});
