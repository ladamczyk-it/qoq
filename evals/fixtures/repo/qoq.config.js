export default {
  srcPath: './src',
  stats: false,
  knip: {
    entry: './src/index.ts',
    project: './src/**/*.ts',
  },
  eslint: [{ template: 'qoq-eslint-v9-ts', files: ['src/**/*.ts'], ignores: ['**/*.spec.ts'] }],
};
