import { stripTypeScriptTypes } from 'module';

import type { Loader } from 'cosmiconfig';

// cosmiconfig's built-in .ts loader transpiles the config to a sibling
// `qoq.config.ts.<uuid>.mjs`, imports it, then removes it in a finally block.
// That file is briefly visible in the project root and leaks outright if the
// process is killed mid-run. Strip the types in memory (Node >=22.15 ships
// `stripTypeScriptTypes`) and import a data: URL, so nothing ever hits disk.
// The documented TS config is `export default {...} satisfies QoqConfig` with a
// type-only import, which strips to a self-contained module; a config that needs
// real runtime imports should use qoq.config.mjs.
export const loadTsConfig: Loader = async (_filepath, content) => {
  const originalEmitWarning = process.emitWarning.bind(process);
  // `stripTypeScriptTypes` is flagged experimental and prints a one-off warning;
  // swallow only that one so a .ts config run stays quiet.
  process.emitWarning = (warning, ...rest: unknown[]) => {
    if (typeof warning === 'string' && warning.includes('stripTypeScriptTypes')) {
      return;
    }

    // @ts-expect-error — forwarding the original variadic overloads verbatim
    originalEmitWarning(warning, ...rest);
  };

  let stripped: string;
  try {
    stripped = stripTypeScriptTypes(content, { mode: 'strip' });
  } finally {
    process.emitWarning = originalEmitWarning;
  }

  const url = `data:text/javascript;base64,${Buffer.from(stripped).toString('base64')}`;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  return (await import(url)).default;
};
