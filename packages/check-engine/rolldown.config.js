import { readFileSync } from 'fs';
import { builtinModules } from 'module';
import { defineConfig } from 'rolldown';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const sourceDir = './src';
const external = [...builtinModules, ...Object.keys(pkg.dependencies)];

export default defineConfig([
  {
    input: {
      'check-engine': `${sourceDir}/index.ts`,
    },
    external,
    platform: 'node',
    output: [
      {
        dir: './bin',
        entryFileNames: '[name].js',
        minify: true,
      },
    ],
  },
]);
