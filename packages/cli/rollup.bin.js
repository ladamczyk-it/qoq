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

// Skillslint is run through its JS API via runtime dynamic import() and is
// installed on demand into the consumer project (see SkillslintConfigHandler),
// so it must stay external rather than be bundled here.
const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
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
