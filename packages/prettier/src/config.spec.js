import { format } from 'prettier';
import { describe, test, expect } from 'vitest';

import config from './config.js';

describe('config', () => {
  test('exposes the expected Prettier options', () => {
    expect(config).toStrictEqual({
      trailingComma: 'es5',
      printWidth: 100,
      singleQuote: true,
    });
  });

  test('formats source with Prettier using the config', async () => {
    const formatted = await format('const value = "demo"', { ...config, parser: 'babel' });

    expect(formatted).toBe("const value = 'demo';\n");
  });
});
