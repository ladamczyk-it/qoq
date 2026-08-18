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
    // The plugin manifest carries the same version as the lib; the script writes it.
    // Never edit .claude-plugin/marketplace.json's metadata.version by hand.
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'npm run sync:plugin-version -- ${nextRelease.version}',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          '.claude-plugin/marketplace.json',
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
