import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { syncConfigInspectors } from './sync-config-inspectors.mjs';

const run = promisify(execFile);
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'sync-config-inspectors.mjs');
const SHELL =
  '<script type="importmap">{"imports":{"#entry":"/_nuxt/x.js"}}</script>' +
  '<link href="/_nuxt/x.js"><link href="/favicon.svg">{baseURL:"/",buildAssetsDir:"/_nuxt/"}';

const exists = (path) =>
  access(path).then(
    () => true,
    () => false
  );

describe('syncConfigInspectors', () => {
  let root;
  let packagesDir;
  let outputDir;
  let log;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sync-inspectors-'));
    packagesDir = join(root, 'packages');
    outputDir = join(root, 'out');
    await mkdir(join(packagesDir, 'eslint-v9-a', 'stats'), { recursive: true });
    await writeFile(join(packagesDir, 'eslint-v9-a', 'stats', 'index.html'), SHELL);
    await mkdir(join(packagesDir, 'eslint-v9-b'), { recursive: true });
    await mkdir(join(packagesDir, 'prettier', 'stats'), { recursive: true });
    log = mock.method(console, 'log', () => {});
  });

  afterEach(async () => {
    mock.restoreAll();
    await rm(root, { force: true, recursive: true });
  });

  it('syncs variants and rebases the html shell', async () => {
    const synced = await syncConfigInspectors({ packagesDir, outputDir, baseUrl: '/' });

    assert.deepEqual(synced, ['eslint-v9-a']);
    const html = await readFile(join(outputDir, 'eslint-v9-a', 'index.html'), 'utf8');
    assert.ok(html.includes('="/config-inspector/eslint-v9-a/_nuxt/x.js"'));
    assert.ok(html.includes('="/config-inspector/eslint-v9-a/favicon.svg"'));
    assert.ok(html.includes('baseURL:"/config-inspector/eslint-v9-a/"'));
    assert.ok(html.includes('"#entry":"/config-inspector/eslint-v9-a/_nuxt/x.js"'));
    assert.ok(html.includes('buildAssetsDir:"/_nuxt/"'));
  });

  it('prefixes the site baseUrl', async () => {
    await syncConfigInspectors({ packagesDir, outputDir, baseUrl: '/docs-site/' });

    const html = await readFile(join(outputDir, 'eslint-v9-a', 'index.html'), 'utf8');
    assert.ok(html.includes('="/docs-site/config-inspector/eslint-v9-a/_nuxt/x.js"'));
  });

  it('removes stale variants', async () => {
    await mkdir(join(outputDir, 'eslint-v9-old'), { recursive: true });

    await syncConfigInspectors({ packagesDir, outputDir, baseUrl: '/' });

    assert.equal(await exists(join(outputDir, 'eslint-v9-old')), false);
  });

  it('logs once and leaves outputDir alone when packagesDir is missing', async () => {
    const missing = join(root, 'nope');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'keep.txt'), 'x');

    const synced = await syncConfigInspectors({ packagesDir: missing, outputDir, baseUrl: '/' });

    assert.deepEqual(synced, []);
    assert.equal(log.mock.callCount(), 1);
    assert.ok(String(log.mock.calls[0].arguments[0]).includes(missing));
    assert.equal(await exists(join(outputDir, 'keep.txt')), true);
  });

  it('resolves [] and logs once when no variant has stats', async () => {
    await rm(join(packagesDir, 'eslint-v9-a', 'stats'), { recursive: true });

    const synced = await syncConfigInspectors({ packagesDir, outputDir, baseUrl: '/' });

    assert.deepEqual(synced, []);
    assert.equal(log.mock.callCount(), 1);
  });

  it('rejects on errors other than ENOENT', async () => {
    const file = join(root, 'file');
    await writeFile(file, 'x');

    await assert.rejects(syncConfigInspectors({ packagesDir: file, outputDir, baseUrl: '/' }));
  });

  it('exits 0 when run directly with a missing QOQ_PACKAGES_DIR', async () => {
    await run('node', [SCRIPT], {
      env: { ...process.env, QOQ_PACKAGES_DIR: join(root, 'nope') },
    });
  });
});
