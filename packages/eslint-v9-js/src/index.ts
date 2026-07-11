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

// Rule names (undecorated, no `sonarjs/` prefix) that only make sense in test files —
// their `create()` gates on the project depending on jest/vitest/mocha/chai, not on the
// current file being a spec, so left enabled in the base config they run their full AST
// visitor on every file (see benchmark). Disabled here, restored by eslint-v9-js-jest /
// eslint-v9-js-vitest so they're properly scoped to spec files only.
export const TEST_ONLY_SONARJS_RULES = [
  'no-skipped-tests',
  'no-empty-test-file',
  'assertions-in-tests',
  'no-incomplete-assertions',
  'inverted-assertion-arguments',
  'prefer-specific-assertions',
  'no-trivial-assertions',
  'test-check-exception',
  'stable-tests',
  'no-code-after-done',
  'disabled-timeout',
  'chai-determinate-assertion',
  'no-same-argument-assert',
  'no-exclusive-tests',
  'no-duplicate-test-title',
  'async-test-assertions',
  'no-empty-test-title',
  'hooks-before-test-cases',
  'no-incompatible-assertion-types',
  'no-forced-browser-interaction',
] as const;

// Rule names that only fire on JSX/DOM markup. Disabled here so plain Node/CLI consumers
// of this base config never register them, restored by eslint-v9-js-react.
export const REACT_ONLY_SONARJS_RULES = [
  'jsx-no-leaked-render',
  'no-hook-setter-in-body',
  'no-useless-react-setstate',
  'no-uniq-key',
  'prefer-read-only-props',
  'table-header',
  'table-header-reference',
  'no-table-as-layout',
  'object-alt-content',
  'link-with-target-blank',
] as const;

// Re-exported so packages restoring TEST_ONLY_SONARJS_RULES / REACT_ONLY_SONARJS_RULES
// (eslint-v9-js-jest, -vitest, -react and their ts-* siblings) can look up sonarjs's own
// recommended severity for a given rule without each taking their own dependency on
// eslint-plugin-sonarjs — this package is the only one that needs it directly.
export const SONARJS_RECOMMENDED_RULES: EslintConfig['rules'] = (
  sonarJsPlugin.configs?.recommended as ESLint.Plugin
).rules as unknown as EslintConfig['rules'];

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
    // ignoreExternal skips ~98% of the rule's cost (see benchmark) by never
    // walking into node_modules/workspace-package edges. The CLI overrides
    // this back to false when it detects a monorepo, since sibling workspace
    // packages resolve as "external" too and would otherwise go unchecked.
    'import-x/no-cycle': [1, { ignoreExternal: true }],
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
    ...SONARJS_RECOMMENDED_RULES,
    // AWS/cloud rules are the priciest slice of the sonarjs bundle (see benchmark)
    // and irrelevant to projects with no IaC/AWS SDK code; disable the whole group
    // rather than hand-picking, so newly added aws-* rules are off by default too.
    // Test- and React-only rules are disabled the same way and restored by the
    // packages they actually apply to (see TEST_ONLY_SONARJS_RULES/REACT_ONLY_SONARJS_RULES).
    ...Object.fromEntries(
      [
        ...Object.keys(sonarJsPlugin.rules ?? {}).filter((rule) => rule.startsWith('aws-')),
        ...TEST_ONLY_SONARJS_RULES,
        ...REACT_ONLY_SONARJS_RULES,
      ].map((rule) => [`sonarjs/${rule}`, 0])
    ),
    'sonarjs/no-alphabetical-sort': 0,
    'sonarjs/no-nested-functions': 0,
    'sonarjs/no-misleading-array-reverse': 0,
    'sonarjs/todo-tag': 0,
    'sonarjs/no-redundant-optional': 0,
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
