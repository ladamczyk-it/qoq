import { format } from 'prettier';
import { describe, test, expect } from 'vitest';

import config from './config.js';

describe('config', () => {
  test('extends the base options with JSON sorting', () => {
    expect(config).toStrictEqual({
      trailingComma: 'es5',
      printWidth: 100,
      singleQuote: true,
      plugins: ['prettier-plugin-sort-json'],
      jsonRecursiveSort: true,
    });
  });

  test('formats source with Prettier using the config', async () => {
    const formatted = await format('const value = "demo"', { ...config, parser: 'babel' });

    expect(formatted).toBe("const value = 'demo';\n");
  });

  test('sorts JSON object keys', async () => {
    const formatted = await format('{ "b": 1, "a": 2 }', { ...config, parser: 'json' });

    expect(formatted).toBe('{ "a": 2, "b": 1 }\n');
  });
});
