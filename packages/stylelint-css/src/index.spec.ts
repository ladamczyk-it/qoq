/* eslint-disable vitest/no-unneeded-async-expect-function */
import stylelint from 'stylelint';
import { describe, it, expect } from 'vitest';

import { baseConfig } from './index';

describe('baseConfig', () => {
  it('can lint simple CSS', () => {
    expect(
      async () =>
        await stylelint.lint({
          code: 'a { color: pink; }',
          config: baseConfig,
          formatter: 'verbose',
        })
    ).not.toThrow();
  });
});
