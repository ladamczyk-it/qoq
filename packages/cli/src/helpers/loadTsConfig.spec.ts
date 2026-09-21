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

  it('resolves a real (non-type) npm import against the config file location', async () => {
    const source = [
      "import { isPackageInstalled } from '@ladamczyk/qoq-utils';",
      '',
      "export default isPackageInstalled('cac');",
    ].join('\n');

    // The file need not exist — Node's resolver only needs a real `file:` parent
    // to walk up looking for `node_modules`, which this directory has.
    await expect(
      loadTsConfig(new URL('./qoq.config.ts', import.meta.url).pathname, source)
    ).resolves.toBe(true);
  });
});
