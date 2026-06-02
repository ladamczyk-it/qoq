import { resolveCwdPath } from '@ladamczyk/qoq-utils';

export const PACKAGE_JSON_PATH = resolveCwdPath('/package.json');
export const GITIGNORE_FILE_PATH = resolveCwdPath('/.gitignore');
export const DEFAULT_SRC = './src';
