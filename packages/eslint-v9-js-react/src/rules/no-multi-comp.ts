import { getFunctionComponentCollector } from '@eslint-react/core';

import type { Rule } from 'eslint';

/**
 * The bare rule name (without a plugin prefix). It is registered under the
 * `@eslint-react` namespace in `baseConfig`, so consumers enable it as
 * `@eslint-react/no-multi-comp`.
 */
export const NO_MULTI_COMP_RULE_NAME = 'no-multi-comp';

/**
 * The `@eslint-react/eslint-plugin` runtime exposes its component detection
 * through `@eslint-react/core`'s collectors. `getFunctionComponentCollector`
 * returns a `visitor` (listeners that gather components during traversal) and an
 * `api.getAllComponents(program)` that yields what was found. We run the
 * collector's visitor alongside our own `Program:exit`, where we read the
 * collected components back out. The collector expects `@eslint-react`'s own
 * `RuleContext`, which is structurally the ESLint `Rule.RuleContext`.
 */
type TEslintReactRuleContext = Parameters<typeof getFunctionComponentCollector>[0];

/** A single ESLint visitor (node selector → listener) map. */
type TRuleListener = Record<string, ((node: never) => void) | undefined>;

/**
 * Merge several ESLint visitor maps into one. Listeners registered for the same
 * selector by different maps are all invoked, in the order the maps are passed.
 * This lets the collector's visitor run together with our own `Program:exit`
 * without one overwriting the other.
 */
const mergeListeners = (...listeners: TRuleListener[]): TRuleListener => {
  const grouped = new Map<string, ((node: never) => void)[]>();

  for (const listener of listeners) {
    for (const [selector, fn] of Object.entries(listener)) {
      if (typeof fn !== 'function') {
        continue;
      }

      const existing = grouped.get(selector) ?? [];
      existing.push(fn);
      grouped.set(selector, existing);
    }
  }

  return Object.fromEntries(
    [...grouped].map(([selector, fns]) => [
      selector,
      (node: never) => fns.forEach((fn) => fn(node)),
    ])
  );
};

/**
 * Enforce one React component per file.
 *
 * Inspired by `react/no-multi-comp`, but the component detection is delegated to
 * `@eslint-react/core`'s function-component collector (the same machinery
 * `@eslint-react/eslint-plugin` uses internally) so that wrapped components
 * (`memo`, `forwardRef`, …) and modern function components are recognised
 * consistently with the rest of the preset. Legacy class components are not
 * supported.
 *
 * When more than one component is declared in a file, every component after the
 * first (in source order) is reported.
 */
export const noMultiCompRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce that there is only one React component per file.',
      recommended: true,
      url: 'https://eslint-react.xyz/docs/recipes',
    },
    schema: [],
    messages: {
      onlyOneComponentPerFile:
        'Declare only one React component per file. Move "{{name}}" into its own file.',
    },
  },
  create(context) {
    const functionCollector = getFunctionComponentCollector(
      context as unknown as TEslintReactRuleContext
    );

    const onProgramExit = (program: Rule.Node): void => {
      // `getAllComponents` operates on `@eslint-react`'s TSESTree program node;
      // the ESLint-supplied program is structurally compatible.
      const programNode = program as unknown as Parameters<
        typeof functionCollector.api.getAllComponents
      >[0];

      const components = functionCollector.api
        .getAllComponents(programNode)
        .sort((a, b) => a.node.range[0] - b.node.range[0]);

      // The first declared component is allowed; report every one after it.
      for (const component of components.slice(1)) {
        context.report({
          node: component.node as unknown as Rule.Node,
          messageId: 'onlyOneComponentPerFile',
          data: { name: component.name ?? 'Component' },
        });
      }
    };

    // Assigned by key (not declared as an object-literal method) because the
    // `Program:exit` selector isn't a valid identifier.
    const ownListener: TRuleListener = {};
    ownListener['Program:exit'] = onProgramExit;

    return mergeListeners(functionCollector.visitor, ownListener) as Rule.RuleListener;
  },
};
