import stylelint from 'stylelint';
import { describe, it, expect } from 'vitest';

import { baseConfig } from './index';

describe('baseConfig', () => {
  it('can lint simple CSS', async () => {
    await expect(
      stylelint.lint({
        code: 'a { color: pink; }',
        config: baseConfig,
        formatter: 'verbose',
      })
    ).resolves.toBeDefined();
  });
});
