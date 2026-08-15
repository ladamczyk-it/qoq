import { EslintConfig, EslintLayer, jsLayer } from '@ladamczyk/qoq-eslint-v9-js';
import { vitestLayer } from '@ladamczyk/qoq-eslint-v9-js-vitest';
import { defineConfig } from 'eslint/config';
import testingLibrary from 'eslint-plugin-testing-library';

import type { Linter } from 'eslint';

const disabledRules: EslintConfig['rules'] = {
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
 * Everything this package adds or changes on top of the JS-Vitest base, as a single
 * flat-config layer for `defineConfig` composition. Contains only RTL concerns — no
 * vitest- or JS-specific overrides — so `eslint-v9-ts-vitest-rtl` can consume it directly.
 */
export const rtlLayer: EslintLayer = {
  name: 'qoq-eslint-v9-js-vitest-rtl',
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
 * Flat-config array form: the JS base, the vitest layer, the RTL layer, and the JS-only
 * relaxations, merged per file by ESLint's own cascade instead of being pre-merged.
 * Composed from delta layers (never from `eslint-v9-js-vitest`'s own `configs.base`),
 * which would re-apply the JS base mid-chain and clobber the vitest layer's rule restorations.
 */
export const configs: Record<'base', Linter.Config[]> = {
  base: defineConfig(jsLayer, vitestLayer, rtlLayer, {
    name: 'qoq-eslint-v9-js-vitest-rtl-js-only',
    rules: jsOnlyDisabledRules,
  }),
};
