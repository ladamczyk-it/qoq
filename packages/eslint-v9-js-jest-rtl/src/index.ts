import { EslintConfig, baseConfig as jsBaseConfig } from '@ladamczyk/qoq-eslint-v9-js';
import { jestLayer } from '@ladamczyk/qoq-eslint-v9-js-jest';
import { defineConfig } from 'eslint/config';
import testingLibrary from 'eslint-plugin-testing-library';

import type { Linter } from 'eslint';

export const disabledRules: EslintConfig['rules'] = {
  'testing-library/prefer-screen-queries': 0,
};

// Not part of `flat/react` recommended. Pushes toward accessible queries (role/label/text)
// over implementation-detail selectors, in the spirit of the RTL rules already enabled here.
const additionalTestingLibraryRules: EslintConfig['rules'] = {
  'testing-library/prefer-user-event': 1,
};

// This package configures no TypeScript parser/project, matching eslint-v9-js-vitest's own
// `jsOnlyDisabledRules` (not exported by that package, so re-declared here) — see that
// package's src/index.ts for the full rationale.
const jsOnlyDisabledRules: EslintConfig['rules'] = {
  'sonarjs/no-incompatible-assertion-types': 0,
};

/**
 * Everything this package adds or changes on top of the JS-Jest base, as a single
 * flat-config layer for `defineConfig` composition. Contains only RTL concerns — no
 * jest- or JS-specific overrides — so `eslint-v9-ts-jest-rtl` can consume it directly.
 */
export const rtlLayer: EslintConfig = {
  name: 'qoq-eslint-v9-js-jest-rtl',
  plugins: testingLibrary.configs['flat/react'].plugins ?? {},
  rules: {
    // Upstream types this as `Partial<Linter.RulesRecord>`, widening spread values to
    // include `undefined`; cast narrows back since the plugin never actually emits one.
    ...(testingLibrary.configs['flat/react'].rules as EslintConfig['rules']),
    ...additionalTestingLibraryRules,
    ...disabledRules,
  },
};

/**
 * Flat-config array form: the JS base, the jest layer, the RTL layer, and the JS-only
 * relaxations, merged per file by ESLint's own cascade instead of being pre-merged with
 * `objectMergeRight`. Composed from delta layers (never from `eslint-v9-js-jest`'s own
 * `configs.base`), which would re-apply the JS base mid-chain and clobber the jest
 * layer's rule restorations.
 */
export const configs: Record<'base', Linter.Config[]> = {
  base: defineConfig(jsBaseConfig, jestLayer, rtlLayer, {
    name: 'qoq-eslint-v9-js-jest-rtl-js-only',
    rules: jsOnlyDisabledRules,
  }),
};
