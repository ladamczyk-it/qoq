import { resolve } from 'path';

const { configs } = await import(resolve(__dirname, 'lib/index.mjs'));

export default configs.base;
