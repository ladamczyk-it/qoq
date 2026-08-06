import { describe, it, expect } from 'vitest';

import { getKnipConfig } from './knipConfig';

const defaults = {
  entry: ['.src/index.js'],
  project: ['.src/**/*.js'],
  ignore: ['package.json'],
  ignoreDependencies: [],
  ignoreBinaries: [],
  ignoreFiles: [],
  ignoreMembers: [],
  ignoreUnresolved: [],
};

describe('getKnipConfig', () => {
  it('should return default values', () => {
    expect(getKnipConfig()).toStrictEqual(defaults);
  });

  it('should return custom srcPath', () => {
    const srcPath = 'custom-src';
    expect(getKnipConfig(srcPath)).toStrictEqual({
      ...defaults,
      entry: [`${srcPath}/index.js`],
      project: [`${srcPath}/**/*.js`],
    });
  });

  it('should return custom entry', () => {
    const entry = ['custom-entry.js'];
    expect(getKnipConfig(undefined, entry)).toStrictEqual({ ...defaults, entry });
  });

  it('should return custom project', () => {
    const project = ['custom-project.js'];
    expect(getKnipConfig(undefined, undefined, project)).toStrictEqual({ ...defaults, project });
  });

  it('should return custom ignore', () => {
    const ignore = ['custom-ignore.js'];
    expect(getKnipConfig(undefined, undefined, undefined, ignore)).toStrictEqual({
      ...defaults,
      ignore,
    });
  });

  it('should return custom ignoreDependencies', () => {
    const ignoreDependencies = ['custom-ignore-dependencies.js'];
    expect(
      getKnipConfig(undefined, undefined, undefined, undefined, ignoreDependencies)
    ).toStrictEqual({ ...defaults, ignoreDependencies });
  });

  it('should return custom ignoreBinaries', () => {
    const ignoreBinaries = ['custom-binary'];
    expect(
      getKnipConfig(undefined, undefined, undefined, undefined, undefined, ignoreBinaries)
    ).toStrictEqual({ ...defaults, ignoreBinaries });
  });

  it('should return custom ignoreFiles', () => {
    const ignoreFiles = ['custom-ignore-files.js'];
    expect(
      getKnipConfig(undefined, undefined, undefined, undefined, undefined, undefined, ignoreFiles)
    ).toStrictEqual({ ...defaults, ignoreFiles });
  });

  it('should return custom ignoreMembers', () => {
    const ignoreMembers = ['custom-ignore-members'];
    expect(
      getKnipConfig(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ignoreMembers
      )
    ).toStrictEqual({ ...defaults, ignoreMembers });
  });

  it('should return custom ignoreUnresolved', () => {
    const ignoreUnresolved = ['custom-ignore-unresolved'];
    expect(
      getKnipConfig(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ignoreUnresolved
      )
    ).toStrictEqual({ ...defaults, ignoreUnresolved });
  });

  it('should return multiple custom values', () => {
    const srcPath = 'custom-src';
    const entry = ['custom-entry.js'];
    const project = ['custom-project.js'];
    const ignore = ['custom-ignore.js'];
    const ignoreDependencies = ['custom-ignore-dependencies.js'];
    const ignoreBinaries = ['custom-binary'];
    const ignoreFiles = ['custom-ignore-files.js'];
    const ignoreMembers = ['custom-ignore-members'];
    const ignoreUnresolved = ['custom-ignore-unresolved'];
    const result = getKnipConfig(
      srcPath,
      entry,
      project,
      ignore,
      ignoreDependencies,
      ignoreBinaries,
      ignoreFiles,
      ignoreMembers,
      ignoreUnresolved
    );
    expect(result).toStrictEqual({
      entry,
      project,
      ignore,
      ignoreDependencies,
      ignoreBinaries,
      ignoreFiles,
      ignoreMembers,
      ignoreUnresolved,
    });
  });
});
