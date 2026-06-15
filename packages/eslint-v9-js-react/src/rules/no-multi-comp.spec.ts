import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import { NO_MULTI_COMP_RULE_NAME, noMultiCompRule } from './no-multi-comp';

// Drive `RuleTester` through Vitest's hooks so every case becomes its own
// `it` block with the framework's assertions (rather than running inline).
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const message = (name: string) =>
  `Declare only one React component per file. Move "${name}" into its own file.`;

ruleTester.run(NO_MULTI_COMP_RULE_NAME, noMultiCompRule, {
  valid: [
    // No component at all.
    { code: 'export const add = (a, b) => a + b;' },
    // A single function component.
    { code: 'const App = () => <div />;\nexport default App;' },
    // A single wrapped function component.
    { code: 'const App = memo(() => <div />);\nexport default App;' },
  ],
  invalid: [
    // Two function components.
    {
      code: 'const A = () => <div />;\nconst B = () => <span />;',
      errors: [{ message: message('B') }],
    },
    // Three components: every one after the first is reported.
    {
      code: 'const A = () => <div />;\nconst B = () => <span />;\nconst C = () => <p />;',
      errors: [{ message: message('B') }, { message: message('C') }],
    },
  ],
});
