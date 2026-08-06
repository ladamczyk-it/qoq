import { defineConfig } from 'rolldown';
import { binConfig, libConfig } from '../../configs/eslint-v9/rolldown.config.js';

// React configs depend on ESM-only packages (`@eslint-react/*`,
// `eslint-plugin-react-refresh`) that can't be `require()`d from a CJS bundle,
// so these packages ship ESM-only — drop the CJS output.
export default defineConfig([
  {
    ...libConfig,
    output: libConfig.output.filter((output) => output.format === 'esm'),
  },
  binConfig,
]);
