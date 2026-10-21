import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import c from 'picocolors';

// Project skill, user skill, or the plugin marketplace — any of them means the
// user already has it, and the hint has nothing left to offer.
const isSkillInstalled = (): boolean =>
  [
    join(process.cwd(), '.claude/skills/qoq'),
    join(homedir(), '.claude/skills/qoq'),
    join(homedir(), '.claude/plugins/marketplaces/qoq-agent-skills'),
  ].some((path) => existsSync(path));

// A person at a terminal only: under Claude Code (CLAUDECODE=1) the reader is the
// agent itself, and the line would cost it context on every fix-loop iteration.
export const shouldShowSkillHint = (hints: boolean = true): boolean =>
  hints && !!process.stdout.isTTY && !process.env.CLAUDECODE && !isSkillInstalled();

type TSkillCommand = 'fix' | 'refactor' | 'bump';

// Single-codepoint emoji only: ones needing U+FE0F (♻️, ⬆️) render one or two
// columns depending on the terminal, which breaks the indent below.
const REASONS: Record<TSkillCommand, string> = {
  fix: "🔧 Findings --fix can't resolve",
  refactor: '🧹 Duplicated code',
  bump: '📦 Outdated, deprecated or vulnerable dependencies',
};

// Executors only know their exit code's cause while they run; they note it here
// and the hint printed at the end of the run turns it into a next step.
const suggested = new Set<TSkillCommand>();

export const suggestSkill = (command: TSkillCommand): void => {
  suggested.add(command);
};

export const printSkillHint = (): void => {
  const steps = [...suggested].map((command) => {
    const slash = `/qoq ${command}`;

    return `   ${REASONS[command]} → ${c.cyan(slash)}\n`;
  });

  suggested.clear();

  // Indent of 3 = emoji (2 columns) + space, so every line aligns under the text.
  process.stdout.write(
    [
      `\n🤖 ${c.bold('Using Claude Code?')} The qoq skill is a guarded delivery loop.\n`,
      '   Plans the work, builds it under TDD, lands nothing this CLI rejects.\n',
      ...steps,
      `   ${c.cyan('/plugin marketplace add ladamczyk-it/qoq')}\n`,
      `   ${c.cyan('/plugin install qoq@qoq-agent-skills')}\n`,
      c.gray('   Hide with `hints: false` in qoq.config.js\n'),
    ].join('')
  );
};
