import { createConfig } from '@internal/docusaurus-theme/config';

import packageJson from '../package.json' with { type: 'json' };

export default createConfig({
  tool: 'qoq',
  title: 'QoQ',
  tagline: packageJson.description,
  version: packageJson.version,
  logo: 'img/qoq.svg',
});
