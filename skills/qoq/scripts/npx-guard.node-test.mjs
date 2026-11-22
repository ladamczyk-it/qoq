// node --test skills/qoq/scripts/npx-guard.node-test.mjs
//
// The guard is SKILL.md's own PreToolUse hook. This runs the command exactly as
// the frontmatter ships it, fed the JSON Claude Code sends, under both values
// Claude Code gives CLAUDE_PLUGIN_ROOT: the plugin root (this repo) for the
// installed plugin, and the skill dir itself for a project skill.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const skill = readFileSync(new URL('../SKILL.md', import.meta.url), 'utf8');
const [, indent, block] = skill.match(/\n( +)command: \|\n((?:\1 .*\n)+)/);
const hook = block.replaceAll(new RegExp(`^${indent}  `, 'gm'), '');

const SKILL = fileURLToPath(new URL('..', import.meta.url));
const LAYOUTS = { plugin: join(SKILL, '..', '..'), project: SKILL };

const runHook = (root, input) =>
  spawnSync('bash', ['-c', hook], {
    encoding: 'utf8',
    input,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: root },
  });

// Both layouts must agree; the plugin one is what's returned.
const guard = (command) => {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
  const results = Object.values(LAYOUTS).map((root) => runHook(root, input));
  assert.equal(results[0].status, results[1].status, `layouts disagree on: ${command}`);
  return results[0];
};

test('the hook finds the script in both layouts', () => {
  for (const [layout, root] of Object.entries(LAYOUTS)) {
    assert.equal(runHook(root, '{"tool_input":{"command":"npm test"}}').status, 0, layout);
  }
});

test('a root with no script behind it fails closed', () => {
  assert.equal(runHook('/nonexistent', '{"tool_input":{"command":"npm test"}}').status, 2);
});

test('lets qoq and non-npx commands through', () => {
  for (const command of [
    'npx qoq --check --json',
    'npx qoq',
    'npx --yes qoq staged src/a.ts',
    'cd packages/cli && npx qoq --fix',
    'npm test',
    'npm run test:execute -- src/a.spec.ts',
    'echo npxfoo',
    'npm exec -- qoq --check',
    'node /skill/scripts/entry.mjs --project . --command fix',
    'node --version',
    'node -r ./setup.mjs script.mjs --print-only',
  ]) {
    assert.equal(guard(command).status, 0, command);
  }
});

test('blocks npx for anything but qoq, with the reason on stderr', () => {
  for (const command of [
    'npx vitest run',
    'npx tsc --noEmit',
    'npm test && npx eslint .',
    'npx -y vitest',
    'npx qoqx',
    '(npx prettier --check .)',
    'npm exec vitest',
    'npm exec -- tsc --noEmit',
    'npm x eslint .',
  ]) {
    const { status, stderr } = guard(command);
    assert.equal(status, 2, command);
    assert.match(stderr, /npx is for qoq and nothing else/);
  }
});

test("blocks inline node code, so the allowlist can't be stepped around", () => {
  for (const command of [
    "node -e \"require('fs').rmSync('x')\"",
    'node --eval 1',
    'node -p process.env',
    'node -pe 1',
    'node --input-type=module -e "x"',
    'cd src && node -e 1',
  ]) {
    const { status, stderr } = guard(command);
    assert.equal(status, 2, command);
    assert.match(stderr, /never inline code/);
  }
});

test('a payload with no command passes', () => {
  assert.equal(runHook(LAYOUTS.plugin, '{"tool_input":{}}').status, 0);
});
