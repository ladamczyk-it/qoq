import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { cosmiconfig } from 'cosmiconfig';
import { afterEach, describe, expect, it } from 'vitest';

describe('qoq.config.ts loading', () => {
  let dir = '';

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('loads a type-only-import config natively and leaves no temp file', async () => {
    dir = mkdtempSync(join(tmpdir(), 'qoq-cfg-'));
    writeFileSync(
      join(dir, 'qoq.config.ts'),
      "import type { QoqConfig } from '@ladamczyk/qoq-cli';\nexport default { srcPath: './src' } satisfies QoqConfig;\n"
    );

    const result = await cosmiconfig('qoq', {
      searchStrategy: 'project',
      searchPlaces: ['qoq.config.ts'],
    }).search(dir);

    expect(result?.config).toStrictEqual({ srcPath: './src' });
    expect(readdirSync(dir)).toStrictEqual(['qoq.config.ts']);
  });
});
