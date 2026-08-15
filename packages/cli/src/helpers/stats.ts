/* eslint-disable @typescript-eslint/no-unsafe-call */
import { readFileSync, writeFileSync } from 'fs';

import c from 'picocolors';
import prompts from 'prompts';

const STATS_URL = 'https://stats.adamczyk.ovh';
const STATS_TIMEOUT_MS = 2000;

// Value-less flags only: an option name is the whole payload, so nothing from the
// project (paths, filenames, code, config contents) can ride along. `--output ./x`
// and `--concurrency=auto` are dropped here rather than sanitized later.
export const getUsedOptions = (argv: string[] = process.argv.slice(2)): string[] =>
  argv.filter(
    (arg, index) =>
      arg.startsWith('--') && !arg.includes('=') && (argv[index + 1] ?? '--').startsWith('--')
  );

export const askStatsConsent = async (): Promise<boolean> => {
  process.stdout.write(
    [
      c.bold('\nQoQ usage stats\n'),
      `Send a count of QoQ runs to ${STATS_URL}? Each run posts exactly two things:\n`,
      `  • the tool name — always the literal ${c.cyan('"qoq"')}\n`,
      `  • the flags you typed that take no value, e.g. ${c.cyan('["--check", "--fix"]')}\n`,
      c.gray(
        'Never sent: your code, file names, paths, config contents, tool findings,\n' +
          'project or package names, and nothing identifying you or your machine.\n'
      ),
      c.gray('Stored as `stats: true|false` in qoq.config.js — edit it any time.\n\n'),
    ].join('')
  );

  const { stats } = await prompts.prompt({
    type: 'toggle',
    name: 'stats',
    message: 'Send anonymous usage stats?',
    initial: false,
    active: c.green('yes'),
    inactive: c.red('no'),
  });

  return !!stats;
};

// Splices the single key into the user's own config source; re-serializing the
// parsed config would drop their comments, imports and formatting.
export const writeStatsConsent = (filepath: string, stats: boolean): void => {
  const source = readFileSync(filepath, 'utf8');
  const patched = source.replace(
    /((?:module\.exports\s*=|export\s+default)\s*\{)/,
    `$1 stats: ${stats},`
  );

  if (patched === source) {
    process.stderr.write(
      c.yellow(`\nCouldn't update ${filepath} — add \`stats: ${stats}\` to it to stop asking.\n`)
    );

    return;
  }

  writeFileSync(filepath, patched);
};

// Fire-and-forget: callers don't await it, and a dead or slow endpoint must never
// surface as an error or hold a run up — hence the swallowed catch and the 2s cap.
export const sendStats = async (options: string[]): Promise<void> => {
  try {
    await fetch(STATS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool: 'qoq', options }),
      signal: AbortSignal.timeout(STATS_TIMEOUT_MS),
    });
  } catch {
    // Stats are best-effort; a failed send is not the user's problem.
  }
};
