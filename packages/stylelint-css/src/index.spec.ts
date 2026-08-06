/* eslint-disable vitest/no-unneeded-async-expect-function */
import stylelint from 'stylelint';
import { describe, it, expect } from 'vitest';

import { baseConfig, bemRule } from './index';

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

describe('bemRule', () => {
  it('reports no warnings for a class following the BEM pattern', async () => {
    const { results } = await stylelint.lint({
      code: '.block-name { color: pink; }',
      config: { rules: bemRule },
    });

    expect(results[0]?.warnings).toStrictEqual([]);
  });

  it('reports no warnings for a class using BEM element and modifier suffixes', async () => {
    const { results } = await stylelint.lint({
      code: '.block-name__element--modifier { color: pink; }',
      config: { rules: bemRule },
    });

    expect(results[0]?.warnings).toStrictEqual([]);
  });

  it('reports a warning for a class that does not follow the BEM pattern', async () => {
    const { results } = await stylelint.lint({
      code: '.blockName { color: pink; }',
      config: { rules: bemRule },
    });

    expect(results[0]?.warnings).toHaveLength(1);
  });

  it('includes the BEM methodology guidance in the warning message', async () => {
    const { results } = await stylelint.lint({
      code: '.blockName { color: pink; }',
      config: { rules: bemRule },
    });

    expect(results[0]?.warnings[0]?.text).toContain(
      'Expected class selector ".blockName" to match BEM CSS pattern https://en.bem.info/methodology/css'
    );
  });
});
