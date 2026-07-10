export type TStrippableEslintConfig = {
  [key: string]: unknown;
  plugins?: Record<string, unknown>;
  rules?: Record<string, unknown>;
};

const PRETTIER_PLUGIN_NAME = 'prettier';
const PRETTIER_RULE_PREFIX = 'prettier/';

/**
 * Strips the `eslint-plugin-prettier` plugin registration and every
 * `prettier/*` rule from a flat ESLint config object. Running Prettier
 * through ESLint's AST-based rule pipeline is far slower than running it
 * directly, so CI runs (which already run the standalone Prettier check)
 * skip it here rather than paying for it twice.
 *
 * @param config flat ESLint config object
 * @returns a shallow copy of `config` with the `prettier` plugin and its rules removed
 */
export const stripPrettierPlugin = <T extends TStrippableEslintConfig>(config: T): T => {
  const { plugins, rules, ...rest } = config;

  const strippedPlugins =
    plugins &&
    Object.fromEntries(Object.entries(plugins).filter(([name]) => name !== PRETTIER_PLUGIN_NAME));

  const strippedRules =
    rules &&
    Object.fromEntries(
      Object.entries(rules).filter(([ruleId]) => !ruleId.startsWith(PRETTIER_RULE_PREFIX))
    );

  return {
    ...rest,
    ...(plugins ? { plugins: strippedPlugins } : {}),
    ...(rules ? { rules: strippedRules } : {}),
  } as T;
};
