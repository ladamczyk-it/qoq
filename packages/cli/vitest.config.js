import { defineProject, mergeConfig } from 'vitest/config';
import { commonConfig } from '../../vitest.config.js';

export default mergeConfig(
  commonConfig,
  defineProject({
    test: {
      typecheck: {
        enabled: true,
        tsconfig: './tsconfig.json',
        // The package is bundled with Rolldown, which strips types without
        // checking them; the sources are checked by `npm run typecheck` and by
        // the build's `tsc --emitDeclarationOnly` step instead. Here we only
        // enforce the types declared inside the *.test-d.ts files.
        ignoreSourceErrors: true,
      },
    },
    resolve: {
      tsconfigPaths: true,
    },
  })
);
