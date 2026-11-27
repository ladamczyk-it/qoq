import { createConfig } from '@internal/docusaurus-theme/config';

import packageJson from '../package.json' with { type: 'json' };

const config = createConfig({
  tool: 'qoq',
  title: 'QoQ',
  tagline: packageJson.description,
  version: packageJson.version,
  logo: 'img/qoq.svg',
});

// The one override qoq's site has and its siblings don't: cv's qoq pages use Mermaid and the
// Theme has no Mermaid support. Template sync never bumps `@docusaurus/theme-mermaid`, so bump it
// by hand alongside `@docusaurus/core`.
export default {
  ...config,
  markdown: { ...config.markdown, mermaid: true },
  themes: ['@docusaurus/theme-mermaid', ...(config.themes ?? [])],
  themeConfig: {
    ...config.themeConfig,
    mermaid: {
      options: {
        // The charts line-break their own labels with <br/>; the default 200px wrapping
        // width re-wraps them again.
        flowchart: { wrappingWidth: 420 },
      },
    },
  },
};
