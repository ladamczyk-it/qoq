export enum EModulesPrettier {
  PRETTIER = '@ladamczyk/qoq-prettier',
  PRETTIER_WITH_JSON_SORT = '@ladamczyk/qoq-prettier-with-json-sort',
}

export interface IModulePrettierConfig {
  sources: string[];
}
