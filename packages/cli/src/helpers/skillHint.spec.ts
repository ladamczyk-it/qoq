import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { printSkillHint, shouldShowSkillHint, suggestSkill } from './skillHint.ts';

describe('shouldShowSkillHint', () => {
  let dir: string;
  const { isTTY } = process.stdout;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qoq-hint-'));
    // Empty home and cwd: nothing installed unless a test puts it there.
    vi.stubEnv('HOME', dir);
    vi.stubEnv('CLAUDECODE', '');
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    process.stdout.isTTY = true;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    process.stdout.isTTY = isTTY;
    rmSync(dir, { recursive: true, force: true });
  });

  it('should show to an interactive user without the skill', () => {
    expect(shouldShowSkillHint()).toBe(true);
  });

  it('should respect `hints: false`', () => {
    expect(shouldShowSkillHint(false)).toBe(false);
  });

  it('should stay quiet when piped', () => {
    process.stdout.isTTY = false;

    expect(shouldShowSkillHint()).toBe(false);
  });

  it('should stay quiet inside Claude Code', () => {
    vi.stubEnv('CLAUDECODE', '1');

    expect(shouldShowSkillHint()).toBe(false);
  });

  it.each(['.claude/skills/qoq', '.claude/plugins/marketplaces/qoq-agent-skills'])(
    'should stay quiet when %s is installed',
    (path) => {
      mkdirSync(join(dir, path), { recursive: true });

      expect(shouldShowSkillHint()).toBe(false);
    }
  );
});

describe('printSkillHint', () => {
  // Strip picocolors' escapes so assertions read the plain text.
  const printed = (): string => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    printSkillHint();

    // eslint-disable-next-line no-control-regex
    const text = String(write.mock.calls[0]?.[0]).replace(/\u001b\[\d+m/g, '');

    write.mockRestore();

    return text;
  };

  it('should pitch the loop alone after a clean run', () => {
    const text = printed();

    expect(text).toContain('guarded delivery loop');
    expect(text).not.toContain('→ /qoq');
  });

  it('should name the command each finding calls for, once', () => {
    suggestSkill('bump');
    suggestSkill('refactor');
    suggestSkill('bump');

    const text = printed();

    expect(text).toContain('Outdated, deprecated or vulnerable dependencies → /qoq bump');
    expect(text).toContain('Duplicated code → /qoq refactor');
    expect(text).not.toContain('/qoq fix');
    expect(text.match(/\/qoq bump/g)).toHaveLength(1);
  });

  it('should not carry suggestions into the next hint', () => {
    suggestSkill('fix');
    printed();

    expect(printed()).not.toContain('/qoq fix');
  });
});
