#!/usr/bin/env node
// PreToolUse guard for the agents whose contract is narrower than their tools.
//
// `Bash` can write anything, so "you never edit" in a reporter's body is a
// promise, not a boundary — and an agent permitted to report and fix will
// quietly do both. This makes the boundary real: each role gets an allowlist of
// command heads, every segment of a compound command must match one, and
// output redirection is refused except to /dev/null. `qoq-tester` keeps
// `Write`/`Edit`, but only on test files — the code under test is the one thing
// it must never touch.
//
// An allowlist, not a denylist, because a reporter that hits an unlisted
// command loses a read; a denylist that misses a mutating one loses the
// finding. The message names the role and what it may run, so the agent hands
// back instead of retrying variations.
//
// Usage (from an agent's frontmatter hook):  node agent-guard.mjs <role>
//   reads the hook payload on stdin; exit 0 allows, exit 2 blocks with a reason
//   on stderr. Unknown role → exit 2: a guard that can't tell who called it
//   must not wave the call through.

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = realpathSync(fileURLToPath(new URL('.', import.meta.url)));

// The skill path an agent is handed may run through a symlink (.claude/skills/qoq).
const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

const READ_ONLY = [
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'grep',
  'rg',
  'sort',
  'uniq',
  'echo',
  'pwd',
  'find',
  'test',
  'true',
];
const GIT_READ = [
  'diff',
  'log',
  'show',
  'status',
  'rev-parse',
  'merge-base',
  'ls-files',
  'blame',
  'cat-file',
  'rev-list',
];

const ROLES = {
  'qoq-checker': {
    bash: ['npx qoq --check', 'node', 'npm run build', 'rm -f'],
    // `rm -f` is the ticket form's knip-report delete and nothing else.
    rm: /(^|\/)knip-report\.json$/,
  },
  'qoq-sheriff': { bash: [], git: GIT_READ },
  'qoq-reviewer': { bash: [], git: GIT_READ },
  'qoq-bumper': {
    bash: ['npm view', 'npm ls'],
    git: [...GIT_READ, 'clone', 'fetch', 'tag', 'ls-remote', 'checkout'],
    cloneOutsideProject: true,
  },
  'qoq-tester': {
    bash: ['npm test', 'npm run', 'npx qoq staged', 'node'],
    git: ['diff', 'status', 'log', 'show', 'ls-files'],
    writes: 'tests',
  },
};

// `git clone` options that take a separate value, so the value isn't read as the URL or destination.
const CLONE_VALUE_FLAGS = new Set([
  '--depth',
  '--branch',
  '-b',
  '--origin',
  '-o',
  '--filter',
  '--reference',
  '--config',
  '-c',
  '--jobs',
  '-j',
  '--shallow-since',
  '--shallow-exclude',
  '--separate-git-dir',
]);

const TEST_FILE = /\.(spec|test)\.[^/]+$/;
const TEST_DIR = /(^|\/)(__tests__|__mocks__|__fixtures__|tests?|fixtures|mocks|spec)\//;

const isTestPath = (path) => TEST_FILE.test(path) || TEST_DIR.test(path);

// Split on ; && || | and newlines, outside quotes. Good enough for the
// commands these agents are told to run; anything cleverer is refused below.
const segments = (command) => {
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) {
        quote = null;
      }
      cur += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      cur += c;
    } else if (c === ';' || c === '\n' || c === '|' || (c === '&' && command[i + 1] === '&')) {
      if (command[i + 1] === c) {
        i++;
      }
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
};

const unquote = (word) => (/^(["']).*\1$/.test(word) ? word.slice(1, -1) : word);
const tokens = (segment) => segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];

// `git -C <dir> <sub>` → `<sub>`; other leading options skipped.
const gitSubcommand = (argv) => {
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '-C' || argv[i] === '-c') {
      i++;
    } else if (!argv[i].startsWith('-')) {
      return { sub: argv[i], rest: argv.slice(i + 1) };
    }
  }
  return { sub: undefined, rest: [] };
};

const trimSlashes = (path) => {
  let end = path.length;
  while (end > 1 && path[end - 1] === '/') {
    end--;
  }
  return path.slice(0, end);
};

const inside = (path, dir) => {
  if (!dir) {
    return false;
  }
  const [p, d] = [trimSlashes(path), trimSlashes(dir)];
  return p === d || p.startsWith(`${d}/`);
};

// A redirect is a token holding `>`: `>`, `2>>`, `>file`, `2>&1`. Its target is
// what follows the `>` in the token, or the next token. Only /dev/null and
// another descriptor are allowed. Returns the argv with redirects removed.
const stripRedirects = (argv) => {
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const at = argv[i].indexOf('>');
    if (at === -1 || /^["']/.test(argv[i])) {
      rest.push(unquote(argv[i]));
      continue;
    }
    // `x>file`: the part before `>` is still an argument unless it's a descriptor.
    const before = argv[i].slice(0, at);
    if (!/^\d*$/.test(before)) {
      rest.push(before);
    }
    let target = argv[i].slice(at).replace(/^>>?/, '');
    if (!target) {
      target = argv[++i] ?? '';
    }
    if (target !== '/dev/null' && !/^&\d$/.test(target)) {
      return { error: `output redirection (${argv[i]}) is not allowed` };
    }
  }
  return { argv: rest };
};

const checkGit = (policy, argv, projectDir) => {
  const { sub, rest } = gitSubcommand(argv);
  if (!policy.git?.includes(sub)) {
    return `git ${sub ?? ''} is not allowed`;
  }
  if (sub !== 'clone' || !policy.cloneOutsideProject) {
    return null;
  }
  const positional = rest.filter(
    (w, i) => !w.startsWith('-') && !CLONE_VALUE_FLAGS.has(rest[i - 1])
  );
  const target = positional.at(1);
  if (!target?.startsWith('/') || inside(target, projectDir)) {
    return 'git clone needs an absolute destination outside the project (the scratchpad)';
  }
  return null;
};

const FIND_WRITES = new Set(['-delete', '-exec', '-execdir', '-ok', '-fprint']);

const checkCommand = (policy, argv, projectDir) => {
  const [head] = argv;
  // `cd` writes nothing, but every cli.yaml form is relative, so an agent
  // started in a subdirectory needs it. Absolute and inside the project only:
  // a relative target can't be checked without knowing where the shell is.
  if (head === 'cd') {
    const [, dir, extra] = argv;
    return dir?.startsWith('/') && !extra && inside(real(dir), real(projectDir ?? ''))
      ? null
      : `cd only to an absolute path inside the project (${projectDir})`;
  }
  if (head === 'find' && argv.some((w) => FIND_WRITES.has(w))) {
    return 'find may not delete or exec';
  }
  if (READ_ONLY.includes(head)) {
    return null;
  }
  // `VAR=x cmd` sets the environment for an allowed head: NODE_OPTIONS alone
  // turns `node <script>` into arbitrary code.
  if (/^[A-Za-z_]\w*=/.test(head)) {
    return `inline variable prefixes (${head}) are not allowed`;
  }
  const line = argv.join(' ');
  const allowed = policy.bash.find((p) => line === p || line.startsWith(`${p} `));
  if (!allowed) {
    return `\`${head}\` is not allowed`;
  }
  // `node` means this skill's own scripts — `node -e` would write anything.
  if (allowed === 'node' && !inside(real(argv[1] ?? ''), SCRIPTS_DIR)) {
    return "node may only run this skill's scripts";
  }
  if (allowed === 'rm -f' && !argv.slice(2).every((p) => policy.rm.test(p))) {
    return 'rm may only remove knip-report.json';
  }
  return null;
};

const checkSegment = (policy, segment, projectDir) => {
  if (segment.includes('$(') || segment.includes('`') || segment.includes('<(')) {
    return 'command substitution is not allowed';
  }
  const { argv, error } = stripRedirects(tokens(segment));
  if (error) {
    return error;
  }
  if (!argv.length) {
    return null;
  }
  return argv[0] === 'git'
    ? checkGit(policy, argv, projectDir)
    : checkCommand(policy, argv, projectDir);
};

// What a role may run, printed with every refusal so the agent sees the shape
// once instead of retrying variations of what it was refused.
const shape = (role) => {
  const policy = ROLES[role];
  if (!policy) {
    return 'nothing';
  }
  const git = policy.git?.length ? [`git ${policy.git.join('|')}`] : [];
  return [
    '`cd <absolute dir in the project>`',
    ...[...policy.bash, ...git, ...READ_ONLY].map((c) => `\`${c}\``),
  ].join(', ');
};

export const check = (role, payload, projectDir = process.env.CLAUDE_PROJECT_DIR) => {
  const policy = ROLES[role];
  if (!policy) {
    return `unknown role "${role}"`;
  }
  const { tool_name: tool, tool_input: input = {} } = payload;

  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
    const path = input.file_path ?? input.notebook_path ?? '';
    if (policy.writes === 'tests' && isTestPath(path)) {
      return null;
    }
    return `${tool} on ${path || 'this file'} is outside your contract`;
  }
  if (tool !== 'Bash') {
    return null;
  }

  for (const segment of segments(String(input.command ?? ''))) {
    const reason = checkSegment(policy, segment, projectDir);
    if (reason) {
      return reason;
    }
  }
  return null;
};

// Resolved on both sides: run through .claude/skills/qoq, argv[1] is the symlink
// and import.meta.url the target, and a guard that never enters main allows all.
if (process.argv[1] && real(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , role] = process.argv;
  let raw = '';
  process.stdin
    .on('data', (d) => (raw += d))
    .on('end', () => {
      let reason;
      try {
        reason = check(role, JSON.parse(raw));
      } catch (error) {
        reason = `unreadable hook payload (${error.message})`;
      }
      if (reason) {
        process.stderr.write(
          `${role}: ${reason}. You may run ${shape(role)}, with no inline variables or substitution. Hand back to your caller instead of working around this.\n`
        );
        process.exit(2);
      }
    });
}
