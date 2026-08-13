// Proves that what ESLint actually resolves for each eslint-v9-* package hasn't changed,
// across any config change, by regenerating a baseline from a git ref on demand instead of
// trusting a frozen snapshot. The migration-era oracle this replaces froze one, and could
// never regenerate it once the legacy exports it read were deleted — see Ticket 5.7.
//
// It checks the ref out to a temporary `git worktree` (the only git write command this
// script uses — it never touches the current working tree), installs and builds it there,
// resolves every package's config in both trees through ESLint's own
// `calculateConfigForFile` (via scripts/config-diff.resolver.mjs, run as a subprocess with
// `cwd` set to each tree's own root so ESLint resolves each tree's own plugins), and diffs
// the results.
//
// Deliberately not compared: @eslint/config-inspector's output. Its RPC dump is not
// byte-stable across identical builds (the devalue reference graph's node ordering moves),
// it's structured-clone encoded with no resolvable `devalue` in this repo, and it's invoked
// through an unpinned `npx -y`. Its record-hash "fingerprint" is even less useful — every
// package carries the same hash, since it hashes the RPC method signature, not the payload.

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isDeepStrictEqual } from 'node:util';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const RESOLVER_PATH = resolve(REPO_ROOT, 'scripts', 'config-diff.resolver.mjs');

const PACKAGES = [
  'eslint-v9-js',
  'eslint-v9-js-jest',
  'eslint-v9-js-jest-rtl',
  'eslint-v9-js-react',
  'eslint-v9-js-vitest',
  'eslint-v9-js-vitest-rtl',
  'eslint-v9-ts',
  'eslint-v9-ts-jest',
  'eslint-v9-ts-jest-rtl',
  'eslint-v9-ts-react',
  'eslint-v9-ts-vitest',
  'eslint-v9-ts-vitest-rtl',
];

const FIXTURES = [
  'src/example.js',
  'src/example.jsx',
  'src/example.mjs',
  'src/example.ts',
  'src/example.tsx',
  'src/example.spec.js',
  'src/example.spec.ts',
  'src/example.spec.tsx',
];

// Ticket 2.2 fixed a diamond-extends bug in eslint-v9-ts-react's `configs.base`: the legacy
// pre-migration export merges the TS base on top of the React base, so a plain-tuple JS-base
// rule overwrites the React layer's option overrides on exactly these two rules. Against a
// pre-migration ref this shows up as a real, sanctioned options-only difference — severity
// is unchanged on both sides. Keyed by package *and* rule id, carried over from the
// retired migration oracle's allow-list of the same name. Do not extend this for any other
// package or rule.
const SANCTIONED_OPTION_DELTAS = {
  'eslint-v9-ts-react': {
    'import-x/order': 'react* path group',
    'no-restricted-imports': 'lodash/debounce',
  },
};

// Plan's second sanctioned behavior change — "RESOLVED DECISION — RTL upstream rules restored
// (Option B)" (Tickets 1.4/1.5) — restores 21 `testing-library/*` rules on these four RTL
// packages that a pre-restoration ref resolves as absent. Unlike SANCTIONED_OPTION_DELTAS
// this waives a rule *appearing* (ref severity `undefined` -> this severity), not an existing
// rule's options, so it's a separate map with separate comparison logic below: enumerated
// explicitly, no prefix match, and only `tuple[0]` (severity) is compared — `await-async-events`,
// `no-await-sync-events` and `no-dom-import` carry per-package options (jest vs vitest event
// modules, `no-dom-import`'s framework name) that legitimately differ and aren't part of the
// waiver. `prefer-screen-queries` (disabledRules-forced to 0 on both sides) and
// `prefer-user-event` (a pre-existing local addition on both sides) are deliberately absent —
// they must match exactly, not go through this waiver.
const RTL_RULE_ADDITIONS = {
  'testing-library/await-async-events': 2,
  'testing-library/await-async-queries': 2,
  'testing-library/await-async-utils': 2,
  'testing-library/no-await-sync-events': 2,
  'testing-library/no-await-sync-queries': 2,
  'testing-library/no-container': 2,
  'testing-library/no-dom-import': 2,
  'testing-library/no-global-regexp-flag-in-query': 2,
  'testing-library/no-manual-cleanup': 2,
  'testing-library/no-node-access': 2,
  'testing-library/no-promise-in-fire-event': 2,
  'testing-library/no-render-in-lifecycle': 2,
  'testing-library/no-unnecessary-act': 2,
  'testing-library/no-wait-for-multiple-assertions': 2,
  'testing-library/no-wait-for-side-effects': 2,
  'testing-library/no-wait-for-snapshot': 2,
  'testing-library/prefer-find-by': 2,
  'testing-library/prefer-presence-queries': 2,
  'testing-library/prefer-query-by-disappearance': 2,
  'testing-library/render-result-naming-convention': 2,
  'testing-library/no-debugging-utils': 1,
};

const SANCTIONED_RULE_ADDITIONS = {
  'eslint-v9-js-jest-rtl': RTL_RULE_ADDITIONS,
  'eslint-v9-js-vitest-rtl': RTL_RULE_ADDITIONS,
  'eslint-v9-ts-jest-rtl': RTL_RULE_ADDITIONS,
  'eslint-v9-ts-vitest-rtl': RTL_RULE_ADDITIONS,
};

const run = (command, args, options) => {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });

  if (result.status !== 0) {
    throw new Error(`\`${command} ${args.join(' ')}\` exited with code ${result.status}`);
  }
};

const resolvePackageSnapshot = (packageName, cwd) => {
  const result = spawnSync('node', [join('scripts', 'config-diff.resolver.mjs'), packageName], {
    cwd,
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    throw new Error(
      `resolver failed for ${packageName} in ${cwd}:\n${result.stderr || result.stdout}`
    );
  }

  return JSON.parse(result.stdout);
};

const diffValues = (label, refValue, currentValue, issues) => {
  if (!isDeepStrictEqual(refValue, currentValue)) {
    issues.push({ label, refValue, currentValue });
  }
};

const diffSnapshot = (
  context,
  refSnapshot,
  currentSnapshot,
  issues,
  sanctionedRules,
  ruleAdditions,
  expectedDeltas
) => {
  const ruleIds = new Set([
    ...Object.keys(refSnapshot.rules ?? {}),
    ...Object.keys(currentSnapshot.rules ?? {}),
  ]);

  for (const ruleId of ruleIds) {
    const refRule = refSnapshot.rules?.[ruleId];
    const currentRule = currentSnapshot.rules?.[ruleId];

    // A sanctioned rule *addition* only waives the exact transition ref=undefined ->
    // current severity=<expected> — compared on severity (tuple[0]) alone, since jest/vitest
    // variants legitimately carry different per-rule options. Against `master` (pre-restoration)
    // refRule is always undefined, but a ref taken after the restoration already carries the
    // rule identically on both sides — that's not a regression either, just no delta at all, so
    // it's gated the same way SANCTIONED_OPTION_DELTAS below is: only inspected once the two
    // sides actually differ. Anything that reaches the `else` from there (ref already had it at
    // a different severity/options, or current doesn't match the waived severity) is a real
    // regression, not a delta.
    if (ruleAdditions?.[ruleId] !== undefined && !isDeepStrictEqual(refRule, currentRule)) {
      if (refRule === undefined && currentRule?.[0] === ruleAdditions[ruleId]) {
        expectedDeltas.set(ruleId, `added, severity ${ruleAdditions[ruleId]}`);
      } else {
        issues.push({
          label: `${context} rule=${ruleId}`,
          refValue: refRule,
          currentValue: currentRule,
        });
      }

      continue;
    }

    // A sanctioned rule still fails on a severity change — only its options are waived, and
    // only when they actually differ.
    if (sanctionedRules?.[ruleId] && !isDeepStrictEqual(refRule, currentRule)) {
      if (refRule?.[0] !== currentRule?.[0]) {
        issues.push({
          label: `${context} rule=${ruleId}`,
          refValue: refRule,
          currentValue: currentRule,
        });
      } else {
        expectedDeltas.set(ruleId, sanctionedRules[ruleId]);
      }

      continue;
    }

    diffValues(`${context} rule=${ruleId}`, refRule, currentRule, issues);
  }

  for (const key of ['plugins', 'settings', 'linterOptions', 'languageOptions']) {
    diffValues(`${context} key=${key}`, refSnapshot[key], currentSnapshot[key], issues);
  }
};

const diffPackage = (packageName, refPackageSnapshot, currentPackageSnapshot) => {
  const issues = [];
  const expectedDeltas = new Map();
  const sanctionedRules = SANCTIONED_OPTION_DELTAS[packageName];
  const ruleAdditions = SANCTIONED_RULE_ADDITIONS[packageName];

  for (const fixture of FIXTURES) {
    diffSnapshot(
      `fixture=${fixture}`,
      refPackageSnapshot[fixture],
      currentPackageSnapshot[fixture],
      issues,
      sanctionedRules,
      ruleAdditions,
      expectedDeltas
    );
  }

  return { issues, expectedDeltas };
};

const ref = process.argv[2] || 'master';

const parentDir = mkdtempSync(join(tmpdir(), 'qoq-config-diff-'));
const worktreeDir = join(parentDir, 'worktree');

let hasFailures = false;

try {
  console.log(`Adding a worktree for \`${ref}\` at ${worktreeDir}...`);
  run('git', ['worktree', 'add', '--detach', worktreeDir, ref], { cwd: REPO_ROOT });

  console.log('Installing dependencies in the worktree — this takes minutes, not seconds...');
  run('npm', ['install'], { cwd: worktreeDir });

  console.log('Building the worktree — this takes minutes, not seconds...');
  run('npm', ['run', 'build'], { cwd: worktreeDir });

  mkdirSync(join(worktreeDir, 'scripts'), { recursive: true });
  copyFileSync(RESOLVER_PATH, join(worktreeDir, 'scripts', 'config-diff.resolver.mjs'));

  for (const packageName of PACKAGES) {
    const refSnapshot = resolvePackageSnapshot(packageName, worktreeDir);
    const currentSnapshot = resolvePackageSnapshot(packageName, REPO_ROOT);
    const { issues, expectedDeltas } = diffPackage(packageName, refSnapshot, currentSnapshot);

    if (issues.length > 0) {
      hasFailures = true;

      for (const issue of issues) {
        console.error(`DIFF ${packageName} ${issue.label}`);
        console.error(`  ${ref}:    ${JSON.stringify(issue.refValue)}`);
        console.error(`  current: ${JSON.stringify(issue.currentValue)}`);
      }

      continue;
    }

    const deltaSuffix =
      expectedDeltas.size > 0
        ? ` (${expectedDeltas.size} expected delta${expectedDeltas.size === 1 ? '' : 's'})`
        : '';

    console.log(`OK   ${packageName}${deltaSuffix}`);

    for (const [ruleId, label] of expectedDeltas) {
      console.log(`     ${ruleId.padEnd(50)}${label}`);
    }
  }
} catch (error) {
  console.error(error.message);
  hasFailures = true;
} finally {
  console.log(`Removing worktree at ${worktreeDir}...`);

  try {
    run('git', ['worktree', 'remove', '--force', worktreeDir], { cwd: REPO_ROOT });
  } catch (removeError) {
    console.error(removeError.message);
    hasFailures = true;
  }

  rmSync(parentDir, { recursive: true, force: true });
}

if (hasFailures) {
  process.exit(1);
}
