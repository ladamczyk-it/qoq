import { EslintConfig, baseConfig as jsBaseConfig } from '@ladamczyk/qoq-eslint-v9-js';
import { objectMergeRight } from '@ladamczyk/qoq-utils';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importPlugin, { createNodeResolver } from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

const { plugins: jsBaseConfigPlugins, ...jsBaseConfigRest } = jsBaseConfig;

const tsPluginConfigs = (tseslint.plugin as unknown as { configs: Record<string, EslintConfig> })
  .configs;

// Spread at typescript-eslint's own severities, same policy as the sonarjs bundle in the
// JS base: the qoq CLI fails on warnings and errors alike, so remapping a preset's
// severity carries no signal — presets ride through as-is, and only hand-picked rules
// (all warn) set severity explicitly.
const TS_RECOMMENDED_RULES: EslintConfig['rules'] = {
  ...(tsPluginConfigs.recommended as EslintConfig).rules,
  ...(tsPluginConfigs['recommended-requiring-type-checking'] as EslintConfig).rules,
};

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
      // TypeScript's compiler already guarantees what these three check (shape of
      // namespace/default imports, members of named exports), and they're among the
      // slowest import-x rules — typescript-eslint's performance guide recommends
      // disabling them under TS. import-x's own `typescript` config above only turns
      // off `named`; `no-unresolved` is kept deliberately, since it powers the CLI's
      // monorepo path-alias resolver diagnostics.
      'import-x/namespace': 0,
      'import-x/default': 0,
      'import-x/no-named-as-default-member': 0,
      ...TS_RECOMMENDED_RULES,
      '@typescript-eslint/no-unsafe-assignment': 0, // strange rule, turned off for now
      // TypeScript's own type-checker (noImplicitThis, on by default under `strict`) already
      // flags invalid `this` usage, with better flow analysis than this rule and none of its
      // false positives on TS-idiomatic patterns (class fields, arrow-function properties).
      // typescript-eslint's own docs recommend disabling it for exactly this reason.
      'no-invalid-this': 0,
      // duplicate of @typescript-eslint/no-array-delete (both flag `delete arr[i]`); keep
      // the TS-eslint version since it's type-aware and this package already pays for that.
      'sonarjs/no-array-delete': 0,
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
      // `no-unsafe-assignment` needs no entry here — baseConfig already disables it.
      '@typescript-eslint/no-unsafe-argument': 0,
      '@typescript-eslint/no-unsafe-member-access': 0,
      'sonarjs/no-duplicate-string': 0,
    },
  }
);

/**
 * Opt-in strictness layer on top of `baseConfig`: hand-picked, type-aware rules from
 * typescript-eslint's `strict` family that are too opinionated to enable by default.
 * All net-new enables (none is in the recommended presets baseConfig spreads), at warn
 * like every other hand-picked rule.
 */
export const strictConfig: EslintConfig = objectMergeRight(
  baseConfig as EslintConfig & Record<string, unknown>,
  {
    name: 'qoq-eslint-v9-ts-strict',
    rules: {
      '@typescript-eslint/no-non-null-assertion': 1,
      '@typescript-eslint/no-unnecessary-condition': 1,
      '@typescript-eslint/prefer-reduce-type-parameter': 1,
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 1,
    },
  }
);
