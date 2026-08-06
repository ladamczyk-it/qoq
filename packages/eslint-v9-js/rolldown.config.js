import { defineConfig } from 'rolldown';
import { binConfig, libConfig } from '../../configs/eslint-v9/rolldown.config.js';

// `tools` is imported by every sibling template's `src/bin.ts` as
// `@ladamczyk/qoq-eslint-v9-js/tools`; `stats` backs the config-inspector
// output. Both must ship alongside `index`.
export default defineConfig([
  {
    ...libConfig,
    input: {
      ...libConfig.input,
      tools: './src/tools.ts',
      stats: './src/stats.ts',
    },
  },
  binConfig,
]);
