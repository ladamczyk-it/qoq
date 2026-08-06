export const getKnipConfig: (
  srcPath?: string,
  entry?: string[],
  project?: string[],
  ignore?: string[],
  ignoreDependencies?: string[],
  ignoreBinaries?: string[],
  ignoreFiles?: string[],
  ignoreMembers?: string[],
  ignoreUnresolved?: string[]
) => {
  entry: string[];
  project: string[];
  ignore: string[];
  ignoreDependencies: string[];
  ignoreBinaries: string[];
  ignoreFiles: string[];
  ignoreMembers: string[];
  ignoreUnresolved: string[];
} = (
  srcPath = '.src',
  entry = [`${srcPath}/index.js`],
  project = [`${srcPath}/**/*.js`],
  ignore = ['package.json'],
  ignoreDependencies = [],
  ignoreBinaries = [],
  ignoreFiles = [],
  ignoreMembers = [],
  ignoreUnresolved = []
) => ({
  entry,
  project,
  ignore,
  ignoreDependencies,
  ignoreBinaries,
  ignoreFiles,
  ignoreMembers,
  ignoreUnresolved,
});
