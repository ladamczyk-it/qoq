// Consent records shared by `stats.mjs` and `learn.mjs`. Each one is a single
// boolean key, resolved in one order, most specific first:
//   1. the project's own `qoq.config.*`, the same file the CLI reads `stats` from
//   2. ~/.claude/qoq/consent.md, for projects with no config, and the reason a
//      decline doesn't get re-asked in every new checkout
// Neither present means nobody has been asked, which only the caller can fix.
//
// One module for both keys because the fallback file holds both: a writer that
// knew only its own key would erase the other's answer, and the symptom is
// asking someone who already said no.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_FILES = ['qoq.config.ts', 'qoq.config.js', 'qoq.config.cjs', 'qoq.config.mjs'];

const consentFile = () => join(homedir(), '.claude', 'qoq', 'consent.md');

const findConfig = (projectDir) =>
  CONFIG_FILES.map((name) => join(projectDir, name)).find((path) => existsSync(path));

// Read and write the config as source text, never as a parsed object: these
// files import workspace packages and carry the user's comments, so evaluating
// one is expensive and re-serializing it would throw their formatting away.
// Both keys are unique in the schema, so a bare match is safe.
const readKey = (source, key) => {
  const match = new RegExp(`\\b${key}\\s*:\\s*(true|false)\\b`).exec(source);

  return match ? match[1] === 'true' : undefined;
};

export const readConsent = (key, projectDir) => {
  const config = findConfig(projectDir);
  const fromConfig = config ? readKey(readFileSync(config, 'utf8'), key) : undefined;

  if (fromConfig !== undefined) {
    return fromConfig;
  }

  const file = consentFile();

  return existsSync(file) ? readKey(readFileSync(file, 'utf8'), key) : undefined;
};

// The insert is written in the shape Prettier would print, because a consent
// answer that leaves the config unformatted turns the next gate red on a file
// the ticket never touched: on its own line at the next line's indent for a
// multi-line object, `{ key: value }` for an empty one, inline otherwise.
const writeConfig = (path, key, value) => {
  const source = readFileSync(path, 'utf8');
  const patched = source.replace(
    /((?:module\.exports\s*=|export\s+default)\s*\{)(\s*\}|\n([ \t]*))?/,
    (_, open, rest, indent) => {
      if (indent !== undefined) {
        return `${open}\n${indent}${key}: ${value},\n${indent}`;
      }

      return rest ? `${open} ${key}: ${value} }` : `${open} ${key}: ${value},`;
    }
  );

  if (patched === source) {
    return false;
  }

  writeFileSync(path, patched);

  return true;
};

const writeFile = (key, value) => {
  const file = consentFile();
  const previous = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const answers = Object.fromEntries(
    ['stats', 'learning']
      .map((name) => [name, name === key ? value : readKey(previous, name)])
      .filter(([, answer]) => answer !== undefined)
  );

  mkdirSync(join(homedir(), '.claude', 'qoq'), { recursive: true });
  writeFileSync(
    file,
    [
      '---',
      ...Object.entries(answers).map(([name, answer]) => `${name}: ${answer}`),
      '---',
      '',
      `Recorded ${new Date().toISOString().slice(0, 10)} by the qoq skill.`,
      'Delete this file to be asked again.',
      '',
    ].join('\n')
  );
};

// The config is where the CLI looks too, so recording there means the user is
// asked once by either entry point rather than once by each.
export const recordConsent = (key, value, projectDir) => {
  const config = findConfig(projectDir);

  if (!config || !writeConfig(config, key, value)) {
    writeFile(key, value);
  }
};
