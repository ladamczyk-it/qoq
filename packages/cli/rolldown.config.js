import { readFileSync } from 'fs';
import { builtinModules } from 'module';
import { defineConfig } from 'rolldown';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const sourceDir = './src';

// Skillslint, Structurelint, Stylelint, JSCPD, Prettier and ESLint are run through their JS APIs
// via runtime dynamic import() and resolve from the consumer's on-demand install
// (skillslint via its peer dependency, stylelint via the @ladamczyk/qoq-stylelint-*
// templates, jscpd via the @ladamczyk/qoq-jscpd template, prettier via the
// @ladamczyk/qoq-prettier* templates, eslint via the @ladamczyk/qoq-eslint-v9-*
// templates), so they must stay external rather than be bundled here.
// These are deliberately plain strings, which match an import specifier exactly and so
// leave *subpath* imports to be bundled. That is load-bearing, not an oversight:
// `src/index.ts` imports `@npmcli/package-json/lib/read-package` extensionless, and that
// package publishes no `exports` map, so an externalised deep path fails Node's ESM
// resolver at runtime — bundling it is what keeps `qoq` startable.
const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
  'structurelint',
  'stylelint',
  'jscpd',
  'prettier',
  'eslint',
];

export default defineConfig([
  {
    input: {
      qoq: `${sourceDir}/index.ts`,
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
