import { defineProject, mergeConfig } from 'vitest/config';
import { commonConfig } from '../../vitest.config.js';

export default mergeConfig(
  commonConfig,
  defineProject({
    test: {
      typecheck: {
        enabled: true,
        tsconfig: './tsconfig.json',
        // The package is bundled via esbuild/rollup and never type-checked with
        // tsc, so only enforce types declared inside the *.test-d.ts files.
        ignoreSourceErrors: true,
      },
    },
    resolve: {
      tsconfigPaths: true,
    },
  })
);
