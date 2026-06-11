export enum EModulesPrettier {
  PRETTIER = 'qoq-prettier',
  PRETTIER_WITH_JSON_SORT = 'qoq-prettier-with-json-sort',
}

export interface IModulePrettierConfig {
  sources: string[];
}
