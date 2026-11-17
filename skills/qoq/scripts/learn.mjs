#!/usr/bin/env node
// Sends one retro lesson to the learning sink, so a planning or skill mistake
// seen in one project can improve qoq for every project. `references/retro.md`
// decides what is sendable. This script decides whether anything is sent at all.
//
// It's a script for the same reason `stats.mjs` is: consent must not drift. It
// is a separate consent from stats because stats promises a count and nothing
// more, and this payload is a sentence.
//
// Usage:   node learn.mjs --category <c> --text "<lesson>" [--consent yes|no]
//                         [--project <dir>]
//
// Exit code: 0 handled (sent, unreachable, or declined), 1 nobody has been asked
// yet (ask with the disclosure it prints, then call again with --consent),
// 2 usage error, 3 the text looks like project detail and was refused. The check
// runs before consent, so a refused lesson is never what someone agreed to.

import { existsSync, readFileSync } from 'node:fs';

import { readConsent, recordConsent } from './consent.mjs';

// POST only. No pixel fallback, unlike stats: a GET puts the sentence in a URL,
// and URLs land in access logs.
const LEARNING_URL = 'https://learning.adamczyk.ovh';
const TIMEOUT_MS = 2000;
const MAX_TEXT = 500;

// The retro's planning categories, then its environment categories, which is
// what a skill lesson is filed under. Kept in step with `references/retro.md`
// and with the sink's own allowlist.
const CATEGORIES = [
  'decomposition',
  'ticket-context',
  'contract',
  'estimate',
  'navigation',
  'automated-check',
  'coding-standard',
  'steering',
  'tool-economy',
  'information-access',
];

// What a lesson about this project rather than about qoq tends to contain. The
// retro rewrites lessons before they get here, so this is the backstop, not the
// filter: it catches what a pattern can, and the user's approval covers the rest.
const PROJECT_DETAIL = [
  [/`/, 'code in backticks'],
  [/\S\/\S/, 'a path'],
  [/\.(?:[cm]?[jt]sx?|json|ya?ml|md|css|scss|html|py)\b/i, 'a file name'],
  [/[a-z][A-Z]/, 'a camelCase identifier'],
  [/\w_\w/, 'a snake_case identifier'],
  [/@[\w-]+\//, 'a scoped package'],
  [/https?:\/\//, 'a URL'],
];

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);

  return index === -1 ? undefined : args[index + 1];
};

const category = flag('category');
const text = flag('text')?.trim().replace(/\s+/g, ' ');
const consentArg = flag('consent');
const projectDir = flag('project') ?? process.cwd();

if (
  !CATEGORIES.includes(category) ||
  !text ||
  text.length > MAX_TEXT ||
  (consentArg && !['yes', 'no'].includes(consentArg))
) {
  process.stderr.write(
    `usage: learn.mjs --category <${CATEGORIES.join('|')}> --text "<at most ${MAX_TEXT} chars>" ` +
      '[--consent yes|no] [--project <dir>]\n'
  );
  process.exit(2);
}

const leak = PROJECT_DETAIL.find(([pattern]) => pattern.test(text));

if (leak) {
  process.stderr.write(`refused: the lesson contains ${leak[1]}. Rewrite it without it.\n`);
  process.exit(3);
}

// The plugin's version, when this runs from an installed plugin. A copy inside a
// project's `.claude/skills/` has no manifest beside it and says so.
const version = (() => {
  const manifest = new URL('../../../.claude-plugin/marketplace.json', import.meta.url);

  try {
    return existsSync(manifest)
      ? (JSON.parse(readFileSync(manifest, 'utf8')).metadata?.version ?? 'unknown')
      : 'unknown';
  } catch {
    return 'unknown';
  }
})();

const payload = { source: 'qoq-skill', kind: 'retro', version, category, text };

const send = async () => {
  try {
    const response = await fetch(LEARNING_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    return response.ok;
  } catch {
    return false;
  }
};

const report = async (learning) => {
  if (!learning) {
    process.stdout.write('declined\n');
  } else {
    // Said out loud rather than swallowed: the run's summary tells the user what
    // was sent, and "sent" for a lesson that never arrived would be false.
    process.stdout.write((await send()) ? 'sent\n' : 'unreachable\n');
  }

  process.exit(0);
};

if (consentArg) {
  const learning = consentArg === 'yes';

  recordConsent('learning', learning, projectDir);
  await report(learning);
}

const consent = readConsent('learning', projectDir);

if (consent === undefined) {
  process.stdout.write(
    [
      'ask: no learning consent on record',
      '',
      'Put this to the user with AskUserQuestion, on these facts:',
      '',
      `  Each approved lesson posts exactly this shape to ${LEARNING_URL}:`,
      `    ${JSON.stringify(payload)}`,
      '',
      '  Only planning and qoq-skill lessons, each shown in the run summary',
      '  first. Never sent: code lessons, code, paths, file or package names,',
      '  plan contents, or anything identifying the user, project or machine.',
      '  Separate from usage stats. Stored as `learning: true|false` in',
      '  qoq.config, or ~/.claude/qoq/consent.md without one.',
      '',
      'Then call again with --consent yes|no. The answer is recorded and nobody',
      'is asked twice.',
      '',
    ].join('\n')
  );
  process.exit(1);
}

await report(consent);
