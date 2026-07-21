import type { Config } from 'stylelint';

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-empty-object-type
export interface StylelintConfig extends Config {}

export const bemRule = {
  'selector-class-pattern': [
    '^[a-z]([-]?[a-z0-9]+)*(__[a-z0-9]([-]?[a-z0-9]+)*)?(--[a-z0-9]([-]?[a-z0-9]+)*)?$',

    {
      /** This option will resolve nested selectors with & interpolation. - https://stylelint.io/user-guide/rules/selector-class-pattern/#resolvenestedselectors-true--false-default-false */
      resolveNestedSelectors: true,
      /** Custom message */
      message: (selectorValue: string): string => {
        return `Expected class selector "${selectorValue}" to match BEM CSS pattern https://en.bem.info/methodology/css. Selector validation tool: https://regexr.com/3apms`;
      },
    },
  ],
};

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
