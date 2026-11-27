// Copies the prebuilt ESLint Config Inspector sites shipped in each
// `@ladamczyk/qoq-eslint-v9-*` package (their `stats/` folders) into this
// site's `static/config-inspector/<variant>/` directory, rebasing every
// absolute asset path so each inspector can be served — and embedded in an
// iframe — from its own sub-path.
//
// The inspector is a Nuxt SPA: at runtime every asset and RPC request is
// resolved against `window.__NUXT__.config.app.baseURL`, so the only paths
// that must be rewritten are the hardcoded ones in the HTML shell:
//   - the entry `<link>`/`<script>` `/_nuxt/...` references
//   - the importmap's `"#entry":"/_nuxt/..."`, which lazy chunks import —
//     left at the root, every chunk import 404s and the app never mounts
//   - the `/favicon.svg` icon
//   - `app.baseURL` itself
// `buildAssetsDir` is deliberately left as `/_nuxt/`: at runtime Nuxt joins it
// onto `baseURL`, so rewriting it too would double the prefix.
//
// Missing packages or stats are not an error: the docs CI and the template
// propagate build run without `config-inspector` having built them.
//
// Usage:
//   node scripts/sync-config-inspectors.mjs
//   QOQ_PACKAGES_DIR=/path/to/packages node scripts/sync-config-inspectors.mjs
//   SITE_BASE_URL=/ node scripts/sync-config-inspectors.mjs

import { cp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ESLINT_PACKAGE_PREFIX = 'eslint-v9-';
const HTML_FILES = ['index.html', '200.html', '404.html'];

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function findInspectorPackages(packagesDir) {
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const packages = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(ESLINT_PACKAGE_PREFIX)) continue;

    const statsDir = join(packagesDir, entry.name, 'stats');
    if (await isDirectory(statsDir)) {
      packages.push({ variant: entry.name, statsDir });
    }
  }

  return packages.sort((first, second) => first.variant.localeCompare(second.variant));
}

function rebaseHtml(html, base) {
  return html
    .replaceAll('="/_nuxt/', `="${base}_nuxt/`)
    .replaceAll('":"/_nuxt/', `":"${base}_nuxt/`)
    .replaceAll('="/favicon.svg"', `="${base}favicon.svg"`)
    .replaceAll('baseURL:"/"', `baseURL:"${base}"`);
}

async function rebaseHtmlFiles(destination, base) {
  for (const fileName of HTML_FILES) {
    const filePath = join(destination, fileName);

    try {
      const original = await readFile(filePath, 'utf8');
      await writeFile(filePath, rebaseHtml(original, base));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

export async function syncConfigInspectors({ packagesDir, outputDir, baseUrl }) {
  let packages;
  try {
    packages = await findInspectorPackages(packagesDir);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.log(`Packages directory not found at "${packagesDir}"; no config inspectors synced.`);
    return [];
  }

  if (packages.length === 0) {
    console.log(
      `No "${ESLINT_PACKAGE_PREFIX}*/stats" inspectors in "${packagesDir}"; none synced.`
    );
    return [];
  }

  await rm(outputDir, { force: true, recursive: true });

  for (const { variant, statsDir } of packages) {
    const base = `${baseUrl.replace(/\/$/, '')}/config-inspector/${variant}/`;
    const destination = join(outputDir, variant);

    await cp(statsDir, destination, { recursive: true });
    await rebaseHtmlFiles(destination, base);
    console.log(`✓ ${variant} → ${base}`);
  }

  return packages.map(({ variant }) => variant);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await syncConfigInspectors({
    packagesDir: resolve(process.env.QOQ_PACKAGES_DIR ?? join(PROJECT_ROOT, '..', 'packages')),
    outputDir: join(PROJECT_ROOT, 'static', 'config-inspector'),
    baseUrl: process.env.SITE_BASE_URL ?? '/',
  });
}
