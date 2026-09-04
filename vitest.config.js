import { defineConfig } from 'vitest/config';

// Shared by the per-package project configs. `projects` is deliberately *not*
// here: since Vitest 5 a project config that declares `projects` yields nested
// projects, and the glob would resolve against the package directory.
export const commonConfig = {
  test: {
    coverage: {
      include: ['**/src/**'],
      exclude: [
        '**/__tests__/**',
        '**/lib/**',
        '**/*.spec.[jt]s',
        '**/types.ts',
        '**/*.d.ts',
        '**/bin.{ts,js}',
      ],
    },
  },
};

export default defineConfig({
  test: { ...commonConfig.test, projects: ['packages/*'] },
});
