import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Script } from 'node:vm';

/**
 * Every package's declared `bin` must be loadable by Node in the module system
 * that package's own `package.json` declares. The bundler picks its output
 * format independently of the `type` field, so the two can silently disagree —
 * an ESM bundle in a package without `"type": "module"` ships a binary that
 * dies on `__dirname is not defined in ES module scope`. Build, tests, and lint
 * all stay green through that, because none of them ever loads the artifact.
 *
 * Run after `npm run build`; unbuilt `bin/` output is itself a failure here.
 */
const packagesDir = resolve('./packages');
const failures = [];
let checked = 0;

const readManifest = (packagePath) =>
  JSON.parse(readFileSync(resolve(packagePath, 'package.json'), 'utf-8'));

const checkBin = (packageName, packagePath, isEsm, binPath) => {
  const file = resolve(packagePath, binPath);

  if (!existsSync(file)) {
    failures.push(`${packageName}: "bin" points at ${binPath}, which the build never emits`);
    return;
  }

  checked += 1;
  const source = readFileSync(file, 'utf-8');

  if (isEsm) {
    const [cjsGlobal] = /\b(?:__dirname|__filename)\b/.exec(source) ?? [];

    if (cjsGlobal) {
      failures.push(
        `${packageName}: ${binPath} is ESM (the package declares "type": "module") but uses ${cjsGlobal}, which only exists in CommonJS`
      );
    }

    return;
  }

  try {
    // Parses as a CommonJS script — throws on `import`/`export`, which is
    // exactly the mismatch a type-less package cannot survive.
    new Script(source);
  } catch (error) {
    failures.push(
      `${packageName}: ${binPath} is not valid CommonJS, yet the package declares no "type": "module" — ${error.message}`
    );
  }
};

for (const packageName of readdirSync(packagesDir)) {
  const packagePath = resolve(packagesDir, packageName);
  const { bin, type } = readManifest(packagePath);

  if (!bin) {
    continue;
  }

  const binPaths = typeof bin === 'string' ? [bin] : Object.values(bin);

  for (const binPath of binPaths) {
    checkBin(packageName, packagePath, type === 'module', binPath);
  }
}

if (failures.length > 0) {
  console.error(`✖ bin smoke check — ${failures.length} problem(s):`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log(`✔ bin smoke check — ${checked} binaries load in their declared module system`);
