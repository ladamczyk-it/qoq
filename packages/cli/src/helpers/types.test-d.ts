import { describe, it, expectTypeOf } from 'vitest';

import { EModulesEslint } from '../modules/eslint/types.ts';
import { EModulesStylelint } from '../modules/stylelint/types.ts';

import type { IScanAdapter, IScanDependency, IScanFinding } from '../types.ts';
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

describe('QoqConfig scan field', () => {
  it('accepts an adapter, a timeout and a failOn threshold under satisfies', () => {
    ({
      scan: {
        adapter: { name: 'x', scan: () => Promise.resolve({ findings: [], complete: true }) },
        timeout: 5000,
        failOn: 'none',
      },
    }) satisfies QoqConfig;
  });

  it('rejects a failOn value that is not a threshold', () => {
    // @ts-expect-error 'medium' is not a failOn value
    ({ scan: { failOn: 'medium' } }) satisfies QoqConfig;
  });
});

describe('scan public types', () => {
  it('constrains finding severity to the five severity levels', () => {
    expectTypeOf<IScanFinding['severity']>().not.toBeAny();
    expectTypeOf<IScanFinding['severity']>().toEqualTypeOf<
      'low' | 'moderate' | 'high' | 'critical' | 'unknown'
    >();
  });

  it('makes fixVersion optional on a finding', () => {
    expectTypeOf<Pick<IScanFinding, 'fixVersion'>>().toEqualTypeOf<{ fixVersion?: string }>();
  });

  it('exposes the adapter, dependency and finding types from the package entry', () => {
    expectTypeOf<IScanAdapter>().not.toBeAny();
    expectTypeOf<IScanAdapter['name']>().toEqualTypeOf<string>();
    expectTypeOf<IScanDependency>().toEqualTypeOf<{
      name: string;
      version: string;
      dev: boolean;
    }>();
    expectTypeOf<IScanFinding['package']>().toEqualTypeOf<string>();
  });
});
