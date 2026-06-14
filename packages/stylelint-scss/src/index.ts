import { baseConfig as baseCssConfig, StylelintConfig } from '@ladamczyk/qoq-stylelint-css';

export const baseConfig: StylelintConfig = {
  ...baseCssConfig,
  extends: ['stylelint-config-standard-scss', 'stylelint-config-clean-order', 'stylelint-prettier'],
  overrides: [
    {
      files: ['*.scss', '**/*.scss'],
      rules: {
        'plugin/no-unsupported-browser-features': [
          true,
          {
            severity: 'warning',
            ignore: ['css-nesting'],
          },
        ],
      },
    },
  ],
};
