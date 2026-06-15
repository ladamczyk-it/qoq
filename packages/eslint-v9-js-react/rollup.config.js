import config from '../../configs/eslint-v9/rollup.eslint.config.js';

// React configs depend on ESM-only packages (`@eslint-react/*`,
// `eslint-plugin-react-refresh`) that can't be `require()`d from a CJS bundle,
// so these packages ship ESM-only — drop the CJS output.
export default {
  ...config,
  output: config.output.filter((output) => output.format === 'esm'),
};
