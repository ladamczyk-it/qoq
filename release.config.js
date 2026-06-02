import dotenv from 'dotenv';

dotenv.config({ path: ['./.env.local'] });

export default {
  branches: ['master'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
      },
    ],
    '@semantic-release/release-notes-generator',
    ['semantic-release-lerna', { latch: 'patch' }],
    '@semantic-release/changelog',
    [
      '@semantic-release/git',
      {
        assets: [
          'CHANGELOG.md',
          'lerna.json',
          'package.json',
          'package-lock.json',
          'packages/*/package.json',
        ],
      },
    ],
    '@semantic-release/github',
  ],
  ci: false,
};
