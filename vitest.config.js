import { defineConfig } from 'vitest/config';

export const commonConfig = {
  test: {
    projects: ['packages/*'],
    coverage: {
      include: ['**/src'],
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

export default defineConfig(commonConfig);
