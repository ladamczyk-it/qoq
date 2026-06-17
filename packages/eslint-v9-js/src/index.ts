/* eslint-disable @typescript-eslint/ban-ts-comment */
import jsRules from '@eslint/js';
import { getPackageInfo } from '@ladamczyk/qoq-utils';
import importPlugin, { createNodeResolver } from 'eslint-plugin-import-x';
import prettierPlugin from 'eslint-plugin-prettier';
import sonarJsPlugin from 'eslint-plugin-sonarjs';
import globals from 'globals';

import type { ESLint, Linter } from 'eslint';

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface EslintConfig extends Linter.Config {
  rules: Linter.RulesRecord;
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-empty-object-type
export interface EslintConfigPlugin extends ESLint.Plugin {
  // just re-export
}

interface IPath {
  name: string;
  importNames?: string[];
  message: string;
}

export const getNoRestrictedImportsPaths = (paths: IPath[] = []): IPath[] => {
  const newPaths: IPath[] = [];

  try {
    getPackageInfo('lodash');

    const message =
      "Please use 'es-toolkit/compat' >= 1.39.3 instead, it's smaller and faster + supports tree shaking by default.";

    newPaths.push(
      {
        name: 'lodash',
        message,
      },
      {
        name: 'lodash/fp',
        message,
      }
    );
  } catch {
    // nothing to do here
  }

  try {
    getPackageInfo('es-toolkit');

    newPaths.push({
      name: 'es-toolkit/compat',
      importNames: ['isEqual'],
      message: "Please use 'react-fast-compare' since it's a lot faster.",
    });
  } catch {
    // nothing to do here
  }

  return [...newPaths, ...paths];
};

export const baseConfig: EslintConfig = {
  name: 'qoq-eslint-v9-js',
  linterOptions: {
    reportUnusedDisableDirectives: true,
  },
  languageOptions: {
    globals: {
      ...globals.node,
    },
  },
  plugins: {
    // @ts-ignore
    'import-x': importPlugin,
    prettier: prettierPlugin,
    sonarjs: sonarJsPlugin,
  },
  rules: {
    ...jsRules.configs.recommended.rules,
    ...importPlugin.configs.recommended.rules,
    'import-x/no-cycle': 1,
    'import-x/no-duplicates': 1,
    'import-x/no-named-default': 1,
    'import-x/no-empty-named-blocks': 1,
    'import-x/no-mutable-exports': 1,
    'import-x/order': [
      1,
      {
        alphabetize: { order: 'asc', caseInsensitive: true },
        distinctGroup: false,
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        'newlines-between': 'always',
      },
    ],
    ...(sonarJsPlugin.configs?.recommended as ESLint.Plugin).rules,
    'sonarjs/no-alphabetical-sort': 0,
    'sonarjs/no-nested-functions': 0,
    'sonarjs/no-misleading-array-reverse': 0,
    'sonarjs/todo-tag': 0,
    /**
     * low value, high check complexity, turned off since performance
     */
    'sonarjs/deprecation': 0,
    'sonarjs/no-commented-code': 0,
    'sonarjs/arguments-order': 0,
    'sonarjs/updated-loop-counter': 0,
    'sonarjs/bool-param-default': 1,
    'sonarjs/prefer-immediate-return': 1,
    ...(prettierPlugin.configs?.recommended as ESLint.Plugin).rules,
    'prettier/prettier': 1,
    'consistent-return': 1,
    curly: [1, 'all'],
    eqeqeq: 1,
    'max-lines': [1, { max: 600, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': [1, { max: 200, skipBlankLines: true, skipComments: true }],
    'no-console': [1, { allow: ['error', 'warn', 'time', 'timeEnd'] }],
    'no-debugger': 1,
    'no-param-reassign': [1, { props: false }],
    'no-restricted-imports': [
      1,
      {
        paths: getNoRestrictedImportsPaths(),
        patterns: [
          {
            group: ['../../*'],
            message: 'Maximum one level back for relative imports, please use path aliases.',
          },
        ],
      },
    ],
    'no-useless-return': 1,
    'no-unassigned-vars': 1,
    'no-useless-assignment': 1,
    'no-alert': 1,
    'no-empty-function': 1,
    'no-eval': 1,
    'no-invalid-this': 1,
    'no-new': 1,
    'no-new-func': 1,
    'no-new-wrappers': 1,
    'no-return-assign': 1,
    'no-unused-expressions': 1,
    'no-useless-call': 1,
    'no-useless-constructor': 1,
    'no-var': 1,
    'prefer-const': 1,
    'prefer-destructuring': 1,
    'prefer-rest-params': 1,
    'require-await': 1,
  },
  settings: {
    'import-x/resolver-next': [createNodeResolver()],
  },
};
