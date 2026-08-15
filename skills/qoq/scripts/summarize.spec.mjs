// node --test skills/qoq/scripts/summarize.spec.mjs
//
// The contract is what reaches the digest, so the test drives the script the way
// qoq-checker does: as a subprocess over a report dir, reading stdout.
//
// It exists because of one bug: knip emits unused files per-issue in the array
// shape, the summarizer read them only from the top-level `files` key, and every
// unused file was dropped silently. A digest that omits a finding is worse than
// one that never ran — the caller reads PASS and nothing says otherwise.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('summarize.mjs', import.meta.url).pathname;

const digestOf = (reports) => {
  const dir = mkdtempSync(join(tmpdir(), 'summarize-'));
  for (const [name, body] of Object.entries(reports)) {
    writeFileSync(join(dir, name), JSON.stringify(body));
  }
  return spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' }).stdout;
};

// The shape knip actually emitted here: one issue object carrying its own `files`.
test('reports unused files from the per-issue array shape', () => {
  const out = digestOf({
    'knip-report.json': {
      issues: [{ file: 'scripts/oracle.js', files: [{ name: 'scripts/oracle.js' }] }],
    },
  });
  assert.match(out, /KNIP/);
  assert.match(out, /unused files/);
  assert.match(out, /scripts\/oracle\.js/);
});

// The other shape the summarizer claims to normalize. Both must reach the digest.
test('reports unused files from the flat top-level shape', () => {
  const out = digestOf({ 'knip-report.json': { files: ['scripts/oracle.js'], issues: {} } });
  assert.match(out, /unused files/);
  assert.match(out, /scripts\/oracle\.js/);
});

// The guard against the failure being invisible: no findings must not look like
// findings, or the test above would pass on a summarizer that prints everything.
test('says nothing about knip when knip found nothing', () => {
  const out = digestOf({ 'knip-report.json': { issues: [] } });
  assert.doesNotMatch(out, /unused files/);
});
