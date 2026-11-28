import type { ReactNode } from 'react';

import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import { HomePage } from '@internal/docusaurus-theme/HomePage';

import { QoqAnimation } from '../components/QoqAnimation';

const TITLE = 'qoq: one quality gate for JavaScript and TypeScript projects';

const DESCRIPTION =
  'qoq runs Prettier, ESLint, Knip, JSCPD, Stylelint and npm checks behind one CLI and config, plus a Claude Code skill that turns it into a delivery loop.';

const TOOLS = [
  {
    name: 'Outdated',
    url: 'https://outdated.adamczyk.ovh/',
    role: 'the dependency check of qoq --check, and the report behind the /qoq bump skill.',
  },
  {
    name: 'Structurelint',
    url: 'https://structurelint.adamczyk.ovh/',
    role: 'optional: validates file and folder structure against your rules.',
  },
  {
    name: 'Skillslint',
    url: 'https://skillslint.adamczyk.ovh/',
    role: 'optional: lints and scores Agent Skills (SKILL.md).',
  },
  {
    name: 'Justify-disable',
    url: 'https://justify-disable.adamczyk.ovh/',
    role: 'optional: requires a written reason for every eslint-disable and stylelint-disable.',
  },
];

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
    <Head>
      <title>{TITLE}</title>
      <meta content={DESCRIPTION} name="description" />
      <meta content={TITLE} property="og:title" />
      <meta content={DESCRIPTION} property="og:description" />
    </Head>
    <QoqAnimation />
    <section className="container margin-vert--lg">
      <h2>Included tools</h2>
      <ul>
        {TOOLS.map(({ name, url, role }) => (
          <li key={name}>
            <Link to={url}>{name}</Link>: {role}
          </li>
        ))}
      </ul>
    </section>
  </HomePage>
);

export default Home;
