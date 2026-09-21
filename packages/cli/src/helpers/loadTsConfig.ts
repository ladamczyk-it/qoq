import { register, stripTypeScriptTypes } from 'module';
import { pathToFileURL } from 'url';

import type { Loader } from 'cosmiconfig';

// cosmiconfig's built-in .ts loader transpiles the config to a sibling
// `qoq.config.ts.<uuid>.mjs`, imports it, then removes it in a finally block.
// That file is briefly visible in the project root and leaks outright if the
// process is killed mid-run. Strip the types in memory (Node >=22.15 ships
// `stripTypeScriptTypes`) and import a data: URL, so nothing ever hits disk.
//
// A data: URL has no filesystem location, so Node's default resolver can't do
// node_modules lookup for a bare specifier imported from one — any real import
// in the config throws ERR_UNSUPPORTED_RESOLVE_REQUEST. The MODULE_MARKER below
// carries the config's real path inside the data: URL itself (as a MIME
// parameter); the resolve hook rewrites just that parentURL to the real
// `file:` URL before delegating to Node's own resolver, so bare and relative
// imports resolve exactly as they would from the real file — without ever
// writing one.
const MODULE_MARKER = 'data:text/javascript;qoq=1;';

const HOOK_SOURCE = `
export async function resolve(specifier, context, next) {
  const { parentURL } = context;
  if (typeof parentURL === 'string' && parentURL.startsWith('${MODULE_MARKER}')) {
    const match = /;realparent=([^;,]+);base64,/.exec(parentURL);
    if (match) {
      return next(specifier, { ...context, parentURL: decodeURIComponent(match[1]) });
    }
  }
  return next(specifier, context);
}
`;

let hookRegistered = false;

const ensureResolveHookRegistered = (): void => {
  if (hookRegistered) {
    return;
  }

  hookRegistered = true;
  register(`data:text/javascript,${encodeURIComponent(HOOK_SOURCE)}`, import.meta.url);
};

export const loadTsConfig: Loader = async (filepath, content) => {
  ensureResolveHookRegistered();

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

  const realParent = encodeURIComponent(pathToFileURL(filepath).href);
  const url = `${MODULE_MARKER}realparent=${realParent};base64,${Buffer.from(stripped).toString('base64')}`;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  return (await import(url)).default;
};
