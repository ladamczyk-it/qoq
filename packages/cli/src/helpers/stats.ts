/* eslint-disable @typescript-eslint/no-unsafe-call */
import { readFileSync, writeFileSync } from 'fs';

// Transport, endpoints and their 2s cap live in qoq-utils, shared with
// structurelint, skillslint and the profiler — one place to change a URL, and
// one place where a failed send is swallowed.
import { sendStats as send, STATS_URL, PIXEL_URL } from '@ladamczyk/qoq-utils';
import c from 'picocolors';
import prompts from 'prompts';

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
      c.gray(`Blocked POST? The same values go to ${PIXEL_URL} as a GET.\n`),
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

// Consent is checked by the callers in `modules/index.ts`; this only binds the
// tool name to the shared sender.
export const sendStats = async (options: string[]): Promise<void> => send('qoq', options);
