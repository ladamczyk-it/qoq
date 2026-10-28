import sonarjs from 'eslint-plugin-sonarjs';

export default [
  {
    files: ['src/**/*.ts'],
    plugins: { sonarjs },
    rules: {
      'sonarjs/no-hardcoded-passwords': 'error',
    },
  },
];
