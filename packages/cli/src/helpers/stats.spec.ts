import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { getUsedOptions, sendStats, writeStatsConsent } from './stats.ts';

describe('getUsedOptions', () => {
  it.each([
    [['--check'], ['--check']],
    [
      ['--check', '--fix'],
      ['--check', '--fix'],
    ],
    [['eslint', 'prettier', '--fix'], ['--fix']],
    // Anything carrying a value is dropped — both spellings.
    [['--output', './reports', '--json'], ['--json']],
    [['--concurrency=auto'], []],
    [['staged', 'src/secret/file.ts'], []],
  ])('should keep only value-less flags from %j', (argv, expected) => {
    expect(getUsedOptions(argv)).toStrictEqual(expected);
  });
});

describe('writeStatsConsent', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'qoq-stats-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it.each([
    ['module.exports = { srcPath: "./src" };', true],
    ['export default { srcPath: "./src" };', false],
    ['export default {} satisfies QoqConfig;', true],
  ])('should splice consent into %s', (source, stats) => {
    const filepath = join(dir, `${source.length}-${String(stats)}.js`);

    writeFileSync(filepath, source);
    writeStatsConsent(filepath, stats);

    // Spliced right after the object opener, so everything the user wrote survives.
    expect(readFileSync(filepath, 'utf8')).toBe(source.replace('{', `{ stats: ${stats},`));
  });

  it('should warn instead of mangling a config it cannot patch', () => {
    const filepath = join(dir, 'indirect.js');
    const source = 'const config = { srcPath: "./src" }; export default config;';
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    writeFileSync(filepath, source);
    writeStatsConsent(filepath, true);

    expect(readFileSync(filepath, 'utf8')).toBe(source);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('stats: true'));

    stderr.mockRestore();
  });
});

describe('sendStats', () => {
  // Transport — both endpoints, the shared deadline, the swallowed failures —
  // is qoq-utils' and tested there. All this binds is the tool name.
  it('should send under the plain qoq name', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));

    await sendStats(['--fix']);

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];

    expect(JSON.parse(init.body)).toStrictEqual({ tool: 'qoq', options: ['--fix'] });

    fetchMock.mockRestore();
  });
});
