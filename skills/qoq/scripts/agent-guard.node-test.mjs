// node --test skills/qoq/scripts/agent-guard.node-test.mjs
//
// `check()` is the policy; the subprocess cases pin the hook contract Claude
// Code reads: exit 2 with a reason on stderr blocks, exit 0 allows.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { check } from './agent-guard.mjs';

const PROJECT = '/work/app';
const SCRIPTS = new URL('.', import.meta.url).pathname;
const bash = (role, command) =>
  check(role, { tool_name: 'Bash', tool_input: { command } }, PROJECT);
const write = (role, file_path, tool_name = 'Write') =>
  check(role, { tool_name, tool_input: { file_path } }, PROJECT);

const allows = (role, command) =>
  assert.equal(bash(role, command), null, `${role} should run: ${command}`);
const blocks = (role, command) =>
  assert.notEqual(bash(role, command), null, `${role} should not run: ${command}`);

test('qoq-checker runs the CLI forms cli.yaml gives it, and nothing that writes', () => {
  allows('qoq-checker', 'npx qoq --check --json');
  allows(
    'qoq-checker',
    'rm -f node_modules/@ladamczyk/qoq-cli/bin/report/knip-report.json && npx qoq --check --json --skip-knip'
  );
  allows('qoq-checker', `node ${SCRIPTS}summarize.mjs node_modules/@ladamczyk/qoq-cli/bin/report`);
  blocks('qoq-tester', 'node /work/app/tests/scripts/x.mjs');
  // Through a symlink, the way a checkout keeps the skill at .claude/skills/qoq.
  const link = join(mkdtempSync(join(tmpdir(), 'agent-guard-')), 'scripts');
  symlinkSync(SCRIPTS, link);
  allows('qoq-checker', `node ${link}/summarize.mjs r`);
  allows(
    'qoq-checker',
    'test -L node_modules/@ladamczyk/qoq-cli && npm run build && npx qoq --check --json'
  );
  allows('qoq-checker', 'npx qoq --check --json 2>&1 > /dev/null');

  blocks('qoq-checker', 'npx qoq --fix');
  blocks('qoq-checker', "node -e \"require('fs').rmSync('src', { recursive: true })\"");
  blocks('qoq-tester', "node -e \"require('fs').writeFileSync('src/a.ts', '')\"");
  blocks('qoq-checker', 'rm -rf src');
  blocks('qoq-checker', "sed -i 's/a/b/' src/index.ts");
  blocks('qoq-checker', 'echo x > src/index.ts');
  blocks('qoq-checker', 'git checkout -- src');
});

test('cd reaches the project from a subdirectory, and goes nowhere else', () => {
  allows('qoq-checker', 'cd /work/app && npx qoq --check --json');
  allows('qoq-tester', 'cd /work/app/packages/x && npm test');
  for (const command of ['cd', 'cd ..', 'cd -', 'cd packages', 'cd /tmp', 'cd /work/apple']) {
    blocks('qoq-checker', command);
  }
  assert.match(bash('qoq-checker', 'cd ..'), /absolute path inside the project \(\/work\/app\)/);
});

test('an inline variable prefix is refused, even before an allowed command', () => {
  blocks('qoq-checker', 'NODE_OPTIONS=--require=/tmp/x.js npx qoq --check --json');
  blocks('qoq-checker', 'cd /work/app && FORCE_COLOR=0 npx qoq --check --json');
  assert.match(bash('qoq-checker', 'CI=1 npx qoq --check --json'), /inline variable/);
});

test('a clever compound still has every segment checked', () => {
  blocks('qoq-sheriff', 'git diff main...HEAD; rm -rf src');
  blocks('qoq-sheriff', 'git log | tee notes.txt');
  blocks('qoq-sheriff', 'echo $(touch pwned)');
  blocks('qoq-sheriff', 'find . -name "*.ts" -delete');
  blocks('qoq-reviewer', 'git diff >> review.md');
  blocks('qoq-sheriff', 'echo x>src/a.ts');
  blocks('qoq-sheriff', 'git diff 1>out.txt');
  allows('qoq-sheriff', 'grep -n "a>b" src/a.ts');
});

test('qoq-sheriff and qoq-reviewer read git history and nothing else', () => {
  for (const role of ['qoq-sheriff', 'qoq-reviewer']) {
    allows(role, 'git diff --stat main...HEAD');
    allows(role, 'git -C /tmp/pr-clone show HEAD:src/auth.ts');
    allows(role, 'git log --oneline -20 && git merge-base main HEAD');
    allows(role, 'grep -rn "eval(" src | head -20');

    blocks(role, 'git commit -am fix');
    blocks(role, 'git apply fix.patch');
    blocks(role, 'npm test');
    blocks(role, "node -e \"require('fs').writeFileSync('x', '')\"");
  }
});

test('qoq-bumper clones only outside the project', () => {
  allows('qoq-bumper', 'git clone --depth 1 https://github.com/eslint/eslint /tmp/scratch/eslint');
  allows('qoq-bumper', 'git -C /tmp/scratch/eslint fetch --tags');
  allows('qoq-bumper', 'npm view eslint versions --json');

  blocks('qoq-bumper', 'git clone --depth 1 https://github.com/eslint/eslint');
  blocks('qoq-bumper', 'git clone https://github.com/eslint/eslint /work/app/vendor/eslint');
  blocks('qoq-bumper', 'git clone https://github.com/eslint/eslint vendor/eslint');
  blocks('qoq-bumper', 'npm install eslint@9');
});

test('qoq-tester writes test files and leaves the code under test alone', () => {
  assert.equal(write('qoq-tester', '/work/app/src/auth/TokenService.spec.ts'), null);
  assert.equal(write('qoq-tester', '/work/app/src/auth/token.test.tsx', 'Edit'), null);
  assert.equal(write('qoq-tester', '/work/app/src/auth/__tests__/helpers.ts'), null);
  assert.equal(write('qoq-tester', '/work/app/test/fixtures/user.json'), null);

  assert.notEqual(write('qoq-tester', '/work/app/src/auth/TokenService.ts'), null);
  assert.notEqual(write('qoq-tester', '/work/app/src/auth/TokenService.ts', 'Edit'), null);
  assert.notEqual(write('qoq-tester', '/work/app/package.json', 'MultiEdit'), null);

  allows('qoq-tester', 'npm test -- src/auth/TokenService.spec.ts');
  allows('qoq-tester', 'npm run test:execute -- src/auth/TokenService.spec.ts');
  allows('qoq-tester', 'npx qoq staged src/auth/TokenService.spec.ts');
  blocks('qoq-tester', 'npx qoq --fix');
  blocks('qoq-tester', "sed -i 's/throw/return/' src/auth/TokenService.ts");
});

test('a reporter has no Write or Edit to fall back on', () => {
  assert.notEqual(write('qoq-sheriff', '/work/app/src/a.spec.ts'), null);
});

test('an unknown role is refused rather than waved through', () => {
  assert.notEqual(bash('qoq-nobody', 'ls'), null);
});

test('run through a symlinked skill directory, the hook still blocks', () => {
  const link = join(mkdtempSync(join(tmpdir(), 'agent-guard-')), 'scripts');
  symlinkSync(SCRIPTS, link);
  const { status } = spawnSync(process.execPath, [`${link}/agent-guard.mjs`, 'qoq-tester'], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: '/work/app/src/a.ts' } }),
  });
  assert.equal(status, 2);
});

test('as a hook: exit 2 and a reason on stderr blocks; exit 0 allows', () => {
  const hook = (role, command) =>
    spawnSync(process.execPath, [new URL('agent-guard.mjs', import.meta.url).pathname, role], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
      encoding: 'utf8',
    });

  const ok = hook('qoq-sheriff', 'git diff');
  assert.equal(ok.status, 0);
  assert.equal(ok.stderr, '');

  const no = hook('qoq-sheriff', 'rm -rf src');
  assert.equal(no.status, 2);
  assert.match(no.stderr, /^qoq-sheriff: `rm` is not allowed\. You may run .*`git diff\|log/);
  assert.match(no.stderr, /Hand back to your caller/);

  assert.equal(
    spawnSync(
      process.execPath,
      [new URL('agent-guard.mjs', import.meta.url).pathname, 'qoq-sheriff'],
      {
        input: 'not json',
        encoding: 'utf8',
      }
    ).status,
    2
  );
});
