import type { Config } from 'stylelint';

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface StylelintConfig extends Config {
  name: string;
}

export const baseConfig: StylelintConfig = {
  name: '@ladamczyk/qoq-stylelint-css',
  extends: ['stylelint-config-standard', 'stylelint-config-clean-order', 'stylelint-prettier'],
  plugins: [
    'stylelint-file-max-lines',
    'stylelint-high-performance-animation',
    'stylelint-no-unsupported-browser-features',
  ],
  rules: {
    'plugin/file-max-lines': 600,
    'plugin/no-low-performance-animation-properties': true,
    'plugin/no-unsupported-browser-features': [
      true,
      {
        severity: 'warning',
      },
    ],
  },
};
