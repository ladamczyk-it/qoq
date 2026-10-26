export default {
  srcPath: './src',
  stats: false,
  knip: {
    entry: './src/main.tsx',
    project: './src/**/*.{ts,tsx}',
  },
  eslint: [
    {
      template: 'qoq-eslint-v9-ts-react',
      files: ['src/**/*.{ts,tsx}'],
      ignores: ['**/*.spec.{ts,tsx}'],
    },
  ],
};
