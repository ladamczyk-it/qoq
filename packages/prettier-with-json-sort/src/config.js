import config from '@ladamczyk/qoq-prettier/config';

export default {
  ...config,
  plugins: ['prettier-plugin-sort-json'],
  jsonRecursiveSort: true,
};
