import type { ReactNode } from 'react';

import { HomePage } from '@internal/docusaurus-theme/HomePage';

import { QoqAnimation } from '../components/QoqAnimation';

const FEATURES = [
  {
    title: 'One gate, every tool',
    description:
      '`qoq --check` runs Prettier, ESLint, Knip, JSCPD, Stylelint and npm-outdated behind one config, the same in CI and pre-push.',
  },
  {
    title: 'Presets you extend',
    description:
      'Each `@ladamczyk/qoq-eslint-v9-*` package exports `configs.*` flat-config arrays you extend with `defineConfig`.',
  },
  {
    title: 'A delivery loop for agents',
    description:
      'The `qoq` Claude Code skill plans, executes and fixes work with the qoq gate as its bar, not just a lint helper.',
  },
];

const OPENER =
  'One command formats, lints and analyzes any JavaScript/TypeScript project with Prettier, ESLint, Knip, JSCPD, Stylelint and more, and a Claude Code skill turns it into a guarded delivery loop.';

const Home = (): ReactNode => (
  <HomePage features={FEATURES} install="npx -y @ladamczyk/qoq-cli --init" opener={OPENER}>
    <QoqAnimation />
  </HomePage>
);

export default Home;
