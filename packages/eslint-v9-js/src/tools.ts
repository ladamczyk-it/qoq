import { spawn } from 'child_process';
import { resolve } from 'path';

export const executeInspector = (dir: string): void => {
  const child = spawn(
    'npx',
    [
      '-y',
      '@eslint/config-inspector',
      '--config',
      resolve(dir, '..', 'eslint.config.local.js'),
      '--basePath',
      dir,
    ],
    { shell: true }
  );

  child.stdout.on('data', (data: Buffer) => {
    process.stdout.write(data.toString('utf-8'));
  });

  child.stderr.on('data', (data: Buffer) => {
    process.stderr.write(data.toString('utf-8'));
  });
};
