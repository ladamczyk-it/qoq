import { resolve } from 'path';

const { baseConfig } = await import(resolve(__dirname, 'lib/index.mjs'));

export default baseConfig;
