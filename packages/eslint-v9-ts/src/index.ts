import { EslintConfig, baseConfig as jsBaseConfig } from '@ladamczyk/qoq-eslint-v9-js';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importPlugin, { createNodeResolver } from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

const { plugins: jsBaseConfigPlugins, ...jsBaseConfigRest } = jsBaseConfig;

const tsPluginConfigs = (tseslint.plugin as unknown as { configs: Record<string, EslintConfig> })
  .configs;

export const baseConfig: EslintConfig = {
  ...objectMergeRight(
    jsBaseConfigRest,
    {
      rules: Object.keys(importPlugin.configs.recommended.rules).reduce(
        (acc: Record<string, undefined>, key) => {
          acc[key] = undefined;

          return acc;
        },
        {}
      ) as unknown as EslintConfig['rules'],
    },
    {
      name: 'qoq-eslint-v9-ts',
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          projectService: true,
        },
      },
      rules: {
        'no-undef': 0, // from plugin page: "It is safe to disable this rule when using TypeScript because TypeScript's compiler enforces this check
        ...importPlugin.configs.typescript.rules,
        'import-x/no-cycle': 1,
        'import-x/no-duplicates': 1,
        'import-x/no-named-default': 1,
        ...(tsPluginConfigs.recommended as EslintConfig).rules,
        ...(tsPluginConfigs['recommended-requiring-type-checking'] as EslintConfig).rules,
        '@typescript-eslint/no-unsafe-assignment': 0, // strange rule, turned off for now
        'no-empty-function': 0,
        '@typescript-eslint/no-empty-function': 1,
        'prefer-destructuring': 0,
        '@typescript-eslint/prefer-destructuring': 1,
        'consistent-return': 0,
        '@typescript-eslint/consistent-return': 1,
        '@typescript-eslint/default-param-last': 1,
        '@typescript-eslint/member-ordering': 1,
        '@typescript-eslint/naming-convention': [
          1,
          {
            selector: 'interface',
            prefix: ['I'],
            format: ['PascalCase'],
          },
          {
            selector: 'typeAlias',
            prefix: ['T'],
            format: ['PascalCase'],
          },
          {
            selector: 'enum',
            prefix: ['E'],
            format: ['PascalCase'],
          },
          {
            selector: 'enumMember',
            format: ['UPPER_CASE'],
          },
          {
            selector: 'class',
            format: ['PascalCase'],
          },
          {
            selector: ['classProperty', 'classMethod', 'method', 'function'],
            format: ['camelCase'],
          },
          {
            selector: ['classProperty'],
            modifiers: ['static'],
            format: ['UPPER_CASE'],
          },
          {
            selector: 'parameter',
            leadingUnderscore: 'allow',
            format: ['camelCase'],
            filter: {
              regex: '(_{1}|_{2})',
              match: false,
            },
          },
          {
            selector: 'variable',
            format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          },
        ],
        '@typescript-eslint/explicit-module-boundary-types': 1,
        '@typescript-eslint/no-misused-promises': [1, { checksVoidReturn: false }],
        '@typescript-eslint/no-unused-vars': [1, { args: 'after-used' }],
        '@typescript-eslint/prefer-for-of': 1,
        '@typescript-eslint/prefer-includes': 1,
        '@typescript-eslint/prefer-nullish-coalescing': 1, // -> https://typescript-eslint.io/rules/prefer-nullish-coalescing/
        '@typescript-eslint/prefer-optional-chain': 1,
        '@typescript-eslint/prefer-readonly': 1,
        '@typescript-eslint/prefer-string-starts-ends-with': 1,
      },
      settings: {
        'import-x/resolver-next': [createTypeScriptImportResolver(), createNodeResolver()],
      },
    }
  ),
  plugins: {
    ...jsBaseConfigPlugins,
    '@typescript-eslint': tseslint.plugin,
  },
};

export const testConfig: EslintConfig = objectMergeRight(
  baseConfig as EslintConfig & Record<string, unknown>,
  {
    rules: {
      '@typescript-eslint/no-unsafe-argument': 0,
      '@typescript-eslint/no-unsafe-assignment': 0,
      '@typescript-eslint/no-unsafe-member-access': 0,
      'sonarjs/no-duplicate-string': 0,
    },
  }
);
