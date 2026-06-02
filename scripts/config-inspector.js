import { spawn } from 'child_process';
import { parse } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';

const paths = [];
const getModifiedFiles = async () =>
  new Promise((resolve, reject) => {
    const child = spawn('git ls-files', ['--modified'], { shell: true });

    child.stdout.on('data', (data) => paths.push(...data.toString('utf-8').split('\n')));

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve(code ?? 0);
    });
  });

const regenerateAll = process.argv.slice(2).includes('all');

if (!regenerateAll) {
  await getModifiedFiles();
}

const allPackages = readdirSync('./packages').filter((path) => path.startsWith('eslint-v9-'));
const emptyPackages = allPackages.filter(
  (packageName) => !existsSync(`./packages/${packageName}/stats`)
);

const packagesToCheck = paths
  .filter((path) => !!path)
  .reduce((acc, current) => {
    const path = parse(current);

    if (path.dir.startsWith('packages/eslint-v9-')) {
      const [, packageName] = path.dir.split('/');

      if (!acc.includes(packageName)) {
        acc.push(packageName);
      }
    }

    return acc;
  }, []);

const executeInspector = async (packageName) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'npx -y @eslint/config-inspector build',
      [
        `--config=packages/${packageName}/eslint.config.local.js`,
        `--outDir=packages/${packageName}/stats`,
      ],
      { shell: true }
    );

    child.stdout.on('data', (data) => {
      process.stdout.write(data.toString('utf-8'));
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data.toString('utf-8'));
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve(code ?? 0);
    });
  });

const packages = regenerateAll ? allPackages : new Set(emptyPackages.concat(packagesToCheck));

for (const packageName of packages) {
  await executeInspector(packageName);
}
