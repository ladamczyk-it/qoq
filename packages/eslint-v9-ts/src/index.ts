import { EslintConfig, baseConfig as jsBaseConfig } from '@ladamczyk/qoq-eslint-v9-js';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importPlugin, { createNodeResolver } from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

const { plugins: jsBaseConfigPlugins, ...jsBaseConfigRest } = jsBaseConfig;

const tsPluginConfigs = (tseslint.plugin as unknown as { configs: Record<string, EslintConfig> })
  .configs;

// typescript-eslint's recommended + recommended-requiring-type-checking rules ship at "error"
// severity; normalize to warn(1)/off(0) like the sonarjs bundle in the JS base does, so severity
// means the same thing regardless of which plugin a rule came from. no-unsafe-* and
// no-misused-promises are excluded and keep their native severity — they're tuned by hand below.
const SEVERITY_NORMALIZATION_EXCLUDED_RULES = new Set([
  '@typescript-eslint/no-unsafe-argument',
  '@typescript-eslint/no-unsafe-assignment',
  '@typescript-eslint/no-unsafe-call',
  '@typescript-eslint/no-unsafe-member-access',
  '@typescript-eslint/no-unsafe-return',
  '@typescript-eslint/no-misused-promises',
]);

const TS_RECOMMENDED_WARN_RULES: EslintConfig['rules'] = Object.fromEntries(
  Object.entries({
    ...(tsPluginConfigs.recommended as EslintConfig).rules,
    ...(tsPluginConfigs['recommended-requiring-type-checking'] as EslintConfig).rules,
  }).map(([rule, severity]) =>
    SEVERITY_NORMALIZATION_EXCLUDED_RULES.has(rule)
      ? [rule, severity]
      : [rule, severity === 0 || severity === 'off' ? 0 : 1]
  )
);

export const baseConfig: EslintConfig = {
  ...objectMergeRight(jsBaseConfigRest, {
    name: 'qoq-eslint-v9-ts',
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      'no-undef': 0, // from plugin page: "It is safe to disable this rule when using TypeScript because TypeScript's compiler enforces this check
      // layers eslint-plugin-import-x's typescript delta (currently just `named: off`, since
      // TS's own resolution supersedes it) on top of the import-x rules already configured in
      // the JS base (recommended + no-cycle/order/no-named-default/etc.), instead of re-deriving
      // them.
      ...importPlugin.configs.typescript.rules,
      ...TS_RECOMMENDED_WARN_RULES,
      '@typescript-eslint/no-unsafe-assignment': 0, // strange rule, turned off for now
      'no-empty-function': 0,
      '@typescript-eslint/no-empty-function': 1,
      'prefer-destructuring': 0,
      '@typescript-eslint/prefer-destructuring': 1,
      'consistent-return': 0,
      '@typescript-eslint/consistent-return': 1,
      '@typescript-eslint/default-param-last': 1,
      // scoped down from the large default preset (which breaks members out by
      // accessibility x static x field/method) to just field/constructor/method grouping,
      // to cut noise/churn while keeping the useful part of the check
      '@typescript-eslint/member-ordering': [1, { default: ['field', 'constructor', 'method'] }],
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
      // default options flag `${aNumber}` / `${aBoolean}`, which are safe and idiomatic;
      // only flag genuinely unsafe interpolations
      '@typescript-eslint/restrict-template-expressions': [
        1,
        { allowNumber: true, allowBoolean: true, allowNullish: true },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 1,
      '@typescript-eslint/no-import-type-side-effects': 1,
      // type-aware deprecation detection; sonarjs/deprecation is off in the JS base for
      // performance (no type info there to make the check cheap) — this package already
      // pays for full type-aware linting, so the check is effectively free here
      '@typescript-eslint/no-deprecated': 1,
      '@typescript-eslint/no-shadow': 1,
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver(), createNodeResolver()],
    },
  }),
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
