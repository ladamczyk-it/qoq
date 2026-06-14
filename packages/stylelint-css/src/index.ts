import type { Config } from 'stylelint';

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-empty-object-type
export interface StylelintConfig extends Config {}

export const baseConfig: StylelintConfig = {
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
