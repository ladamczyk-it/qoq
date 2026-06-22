import { readFileSync } from 'fs';
import { builtinModules } from 'module';
import nodeResolve from '@rollup/plugin-node-resolve';
import { binPlugins } from '../../configs/bin/rollupPlugins.js';

const pkg = JSON.parse(readFileSync('./package.json'));

const sourceDir = './src';
const outputDir = './bin';
const input = {
  qoq: `${sourceDir}/index.ts`,
};
const plugins = [
  nodeResolve({
    preferBuiltins: true,
  }),
  ...binPlugins,
];

// Skillslint, Stylelint, JSCPD and Prettier are run through their JS APIs via
// runtime dynamic import() and resolve from the consumer's on-demand install
// (skillslint via its peer dependency, stylelint via the @ladamczyk/qoq-stylelint-*
// templates, jscpd via the @ladamczyk/qoq-jscpd template, prettier via the
// @ladamczyk/qoq-prettier* templates), so they must stay external rather than be
// bundled here.
const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
  'stylelint',
  'jscpd',
  'prettier',
];

export default {
  input,
  plugins,
  external,
  output: [
    {
      dir: outputDir,
      entryFileNames: '[name].js',
    },
  ],
};
