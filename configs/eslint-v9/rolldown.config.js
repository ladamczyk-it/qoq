import { defineConfig } from 'rolldown';

const sourceDir = './src';

// Rolldown resolves node_modules by default, so without `external` every bare
// specifier — including dependency subpaths like
// `@ladamczyk/qoq-eslint-v9-js/tools` — would be inlined. The regex matches
// anything that is neither relative nor absolute, which is exactly what the
// previous plugin-less Rollup builds left external.
export const libConfig = {
  input: {
    index: `${sourceDir}/index.ts`,
  },
  external: [/^[^./]/],
  output: [
    {
      dir: './lib',
      format: 'esm',
      entryFileNames: '[name].mjs',
    },
    {
      dir: './lib',
      format: 'cjs',
      entryFileNames: '[name].cjs',
    },
  ],
};

export const binConfig = {
  input: {
    bin: `${sourceDir}/bin.ts`,
  },
  external: [/^[^./]/],
  platform: 'node',
  output: [
    {
      dir: './bin',
      // These packages declare no `"type"`, so Node reads `bin/bin.js` as CJS —
      // and `src/bin.ts` uses `__dirname`. Emitting ESM here (the default) ships
      // a binary that dies on `__dirname is not defined in ES module scope`.
      format: 'cjs',
      entryFileNames: '[name].js',
      minify: true,
    },
  ],
};

export default defineConfig([libConfig, binConfig]);
