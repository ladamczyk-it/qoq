export interface IModuleKnipConfig {
  entry: string[];
  project: string[];
  ignore: string[];
  ignoreDependencies: string[];
  ignoreBinaries: string[];
  ignoreFiles: string[];
  ignoreMembers: string[];
  ignoreUnresolved: string[];
}
