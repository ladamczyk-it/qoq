import { describe, it, expectTypeOf } from 'vitest';

import { EModulesEslint } from '../modules/eslint/types.ts';
import { EModulesStylelint } from '../modules/stylelint/types.ts';

import type { QoqConfig } from './types.ts';

describe('QoqConfig template fields', () => {
  it('accepts a valid eslint template as a plain string literal under satisfies', () => {
    ({
      eslint: [{ template: 'qoq-eslint-v9-ts', files: ['src'], ignores: [] }],
    }) satisfies QoqConfig;
  });

  it('accepts a valid stylelint template as a plain string literal under satisfies', () => {
    ({
      stylelint: { strict: true, template: 'qoq-stylelint-css' },
    }) satisfies QoqConfig;
  });

  it('constrains the eslint template to the known template strings', () => {
    type TEslintTemplate = NonNullable<QoqConfig['eslint']>[number]['template'];

    expectTypeOf<TEslintTemplate>().toEqualTypeOf<`${EModulesEslint}` | undefined>();
  });

  it('constrains the stylelint template to the known template strings', () => {
    type TStylelintWithTemplate = Exclude<NonNullable<QoqConfig['stylelint']>, { pattern: string }>;

    expectTypeOf<TStylelintWithTemplate['template']>().toEqualTypeOf<
      `${EModulesStylelint}` | undefined
    >();
  });
});
