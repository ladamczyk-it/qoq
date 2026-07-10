import { describe, it, expect } from 'vitest';

import { stripPrettierPlugin } from './stripPrettierPlugin';

describe('stripPrettierPlugin', () => {
  it('removes the prettier plugin registration and prettier/* rules', () => {
    const config = {
      plugins: { prettier: { rules: {} }, sonarjs: { rules: {} } },
      rules: { 'prettier/prettier': 1, 'sonarjs/no-alphabetical-sort': 0, curly: 1 },
    };

    expect(stripPrettierPlugin(config)).toStrictEqual({
      plugins: { sonarjs: { rules: {} } },
      rules: { 'sonarjs/no-alphabetical-sort': 0, curly: 1 },
    });
  });

  it('leaves configs with no plugins or rules untouched', () => {
    const config = { files: ['**/*.ts'] };

    expect(stripPrettierPlugin(config)).toStrictEqual({ files: ['**/*.ts'] });
  });

  it('does not mutate the input config', () => {
    const config = { plugins: { prettier: {} }, rules: { 'prettier/prettier': 1 } };

    stripPrettierPlugin(config);

    expect(config).toStrictEqual({ plugins: { prettier: {} }, rules: { 'prettier/prettier': 1 } });
  });

  it('drops the plugins key entirely when prettier was the only plugin', () => {
    const config = { plugins: { prettier: {} }, rules: { 'prettier/prettier': 1 } };

    expect(stripPrettierPlugin(config)).toStrictEqual({ plugins: {}, rules: {} });
  });
});
