import { describe, it, expect } from 'vitest';

import { loadTsConfig } from './loadTsConfig.ts';

describe('loadTsConfig', () => {
  it('transpiles a TS config with a type-only import and returns its default export', async () => {
    const source = [
      "import type { QoqConfig } from '@ladamczyk/qoq-cli';",
      '',
      'export default {',
      "  srcPath: './src',",
      '} satisfies QoqConfig;',
    ].join('\n');

    await expect(loadTsConfig('qoq.config.ts', source)).resolves.toStrictEqual({
      srcPath: './src',
    });
  });
});
