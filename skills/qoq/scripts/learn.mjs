#!/usr/bin/env node
// The learning sink's one sender. Two kinds of record, so qoq can improve from
// what happens in projects it can't see:
//   - retro: a planning or skill lesson from `execute`'s retro
//     (`references/retro.md`). Nobody typed it, so it needs the `learning`
//     consent, asked once, separate from stats, which promises a count and
//     nothing more.
//   - feedback: what a user said about a command or agent
//     (`references/feedback.md`). Typing it is the consent, so no flag is read.
// Both pass the same project-detail check before anything else happens.
//
// Usage:
//   learn.mjs --category <c> --text "<lesson>" [--consent yes|no] [--project <dir>]
//   learn.mjs --kind feedback --target <command|agent> --category <c> [--text "..."]
//   learn.mjs --due [--ended-badly]
//
// Exit code, sending: 0 handled (sent, unreachable, or declined), 1 nobody has
// been asked for retro consent yet (ask with the disclosure it prints, then call
// again with --consent), 2 usage error, 3 the text looks like project detail and
// was refused.
// Exit code, --due: 0 ask the end-of-run question now, 1 not yet.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { readConsent, recordConsent } from './consent.mjs';

// POST only. No pixel fallback, unlike stats: a GET puts the sentence in a URL,
// and URLs land in access logs.
const LEARNING_URL = 'https://learning.adamczyk.ovh';
const TIMEOUT_MS = 2000;
const MAX_TEXT = 500;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Per kind, and kept in step with the reference that owns each and with the
// sink's own allowlist. Retro: planning categories, then the environment ones a
// skill lesson is filed under. Feedback: what the end-of-run question offers.
const CATEGORIES = {
  retro: [
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
  ],
  feedback: [
    'satisfied',
    'wrong-result',
    'ignored-instructions',
    'too-much',
    'too-costly',
    'other',
  ],
};

// A feedback target is a command, an agent, or the skill as a whole. Agents are
// read off disk so a new one is a valid target the day it ships.
const TARGETS = [
  'fix',
  'refactor',
  'bump',
  'plan',
  'replan',
  'execute',
  'test',
  'compress',
  'document',
  'mermaid',
  'sheriff',
  'review',
  'qoq',
  ...readdirSync(new URL('../agents/', import.meta.url))
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.slice(0, -3)),
];

// What text about this project rather than about qoq tends to contain. Lessons
// and feedback are rewritten before they get here, so this is the backstop, not
// the filter: it catches what a pattern can, and the preview the user sees
// covers the rest.
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

// One stamp per machine, not per project: the question is about qoq, and a
// person working across five repos shouldn't hear it five times a week.
if (args.includes('--due')) {
  const stamp = join(homedir(), '.claude', 'qoq', 'feedback-asked');
  const last = existsSync(stamp) ? Date.parse(readFileSync(stamp, 'utf8').trim()) : NaN;
  const due = args.includes('--ended-badly') || Number.isNaN(last) || Date.now() - last >= WEEK_MS;

  if (due) {
    mkdirSync(join(homedir(), '.claude', 'qoq'), { recursive: true });
    writeFileSync(stamp, `${new Date().toISOString()}\n`);
  }

  process.stdout.write(due ? 'ask\n' : 'not yet\n');
  process.exit(due ? 0 : 1);
}

const kind = flag('kind') ?? 'retro';
const target = flag('target');
const category = flag('category');
const text = flag('text')?.trim().replace(/\s+/g, ' ') ?? '';
const consentArg = flag('consent');
const projectDir = flag('project') ?? process.cwd();
const feedback = kind === 'feedback';

if (
  !CATEGORIES[kind]?.includes(category) ||
  (feedback ? !TARGETS.includes(target) : !text) ||
  text.length > MAX_TEXT ||
  (consentArg && !['yes', 'no'].includes(consentArg))
) {
  process.stderr.write(
    [
      `usage: learn.mjs --category <${CATEGORIES.retro.join('|')}> --text "<lesson>" [--consent yes|no] [--project <dir>]`,
      `       learn.mjs --kind feedback --target <${TARGETS.join('|')}> --category <${CATEGORIES.feedback.join('|')}> [--text "..."]`,
      '       learn.mjs --due [--ended-badly]',
      `text is at most ${MAX_TEXT} chars`,
      '',
    ].join('\n')
  );
  process.exit(2);
}

const leak = PROJECT_DETAIL.find(([pattern]) => pattern.test(text));

if (leak) {
  process.stderr.write(`refused: the text contains ${leak[1]}. Rewrite it without it.\n`);
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

const payload = {
  source: 'qoq-skill',
  kind,
  version,
  ...(feedback ? { target } : {}),
  category,
  text,
};

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

const report = async (allowed) => {
  if (!allowed) {
    process.stdout.write('declined\n');
  } else {
    // Said out loud rather than swallowed: the user is told what was sent, and
    // "sent" for a record that never arrived would be false.
    process.stdout.write((await send()) ? 'sent\n' : 'unreachable\n');
  }

  process.exit(0);
};

if (feedback) {
  await report(true);
}

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
      `  Each retro lesson posts exactly this shape to ${LEARNING_URL}:`,
      `    ${JSON.stringify(payload)}`,
      '',
      '  Only planning and qoq-skill lessons, each listed in the run summary.',
      '  Never sent: code lessons, code, paths, file or package names, plan',
      '  contents, or anything identifying the user, project or machine.',
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
