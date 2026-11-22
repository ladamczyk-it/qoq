#!/usr/bin/env node
// PreToolUse guard for every Bash call in a session running this skill (SKILL.md's
// frontmatter hook). Two rules:
//   - npx (and npm exec / npm x, which are npx under another name) is for qoq
//     only. Anything else runs as the project's own script, verbatim.
//   - node runs a script file, never inline code (-e, -p). A speed bump, not a
//     boundary: a script written to disk still runs.
//
// It matches anywhere in the command string, so a commit message quoting
// `npx vitest` is blocked too; rare, and the message says why.
//
// Reads the hook payload on stdin; exit 0 allows, exit 2 blocks with the reason
// on stderr.

let input = '';
process.stdin
  .on('data', (d) => (input += d))
  .on('end', () => {
    const command = JSON.parse(input || '{}').tool_input?.command ?? '';
    if (
      /(^|[\s;&|(`])(?:npx|npm\s+(?:exec|x))\s+(?:-{1,2}[\w-]+\s+)*(?!qoq(?:\s|$))[^\s-]/.test(
        command
      )
    ) {
      process.stderr.write(
        'qoq: npx is for qoq and nothing else. Run the project script verbatim (npm test, npm run <script>); a project with no script for this is a question for the user.\n'
      );
      process.exit(2);
    }
    if (
      /(^|[\s;&|(`])node\s+(?:-\S+\s+)*?(?:-[a-zA-Z]*[ep]|--eval|--print)(?=[\s=]|$)/.test(command)
    ) {
      process.stderr.write(
        "qoq: node runs a script file here, never inline code (-e, -p). Use the skill's scripts or the project's own; anything else is a question for the user.\n"
      );
      process.exit(2);
    }
  });
