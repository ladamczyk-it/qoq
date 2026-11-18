import { expect, test } from 'claude-code/testing';
import type { TestBody } from 'claude-code/testing';

const ROOT = '/work/trackbook';
const index = (rows: string) => `# Plan

**Plan status:** in-progress

## Milestones

| #   | Milestone | Status | Depends on | Serves | Summary |
| --- | --------- | ------ | ---------- | ------ | ------- |
${rows}
`;
const FILES: Record<string, string> = {
  [`${ROOT}/program.json`]: JSON.stringify({
    repos: [
      { name: 'be', path: 'trackbook-be', role: 'api' },
      { name: 'ui', path: 'trackbook-fe', role: 'ui' },
      { name: 'telemetry', path: 'trackbook-telemetry', role: 'api' },
    ],
  }),
  [`${ROOT}/program/track-io/brd.md`]: `# Track IO

**Program status:** in-progress

## Master milestones

| #   | Milestone | Status      | Depends on | Roles   | Integration |
| --- | --------- | ----------- | ---------- | ------- | ----------- |
| M1  | Export    | in-progress | none       | api, ui | e2e         |

## Repo plans

| Repo | Plan                      |
| ---- | ------------------------- |
| be   | \`plans/2026-11-18-track-io\` |
| ui   | \`plans/2026-11-18-track-io\` |
| telemetry | none |
`,
  [`${ROOT}/trackbook-be/plans/2026-11-18-track-io/index.md`]: index(
    '| M1 | [Export](m1-export.md) | in-progress | none | M1 | s |'
  ),
  [`${ROOT}/trackbook-be/plans/2026-11-18-track-io/m1-export.md`]: `# Milestone 1: Export

## Tickets

### Ticket 1.1: export endpoint

- **Status:** done

### Ticket 1.2: signed link

- **Status:** in-progress
`,
  [`${ROOT}/trackbook-fe/plans/2026-11-18-track-io/index.md`]: index(
    '| M1 | [Share](m1-share.md) | todo | be:M1 | M1 | s |'
  ),
};

const BAND = {
  plugin: 'qoq',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 40,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const;

const engine = (on: Parameters<TestBody>[1]) => {
  on('tool.call', () => ({ result: {} }));
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e);
    return <Text>engine</Text>;
  });
  on('fs.read', (_: unknown, e: { path: string }) => {
    const value = FILES[e.path];
    if (value === undefined) {
      throw new Error(`ENOENT ${e.path}`);
    }
    return { value };
  });
};

test('the status script run names the program; each repo shows its ticket or its wait', async ($, on) => {
  engine(on);
  await $.tool.call({
    tool: 'Bash',
    command: `node /x/skills/qoq/scripts/program-status.mjs --root ${ROOT} --program track-io --json`,
  });

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface });
    expect(
      await ui.find({
        type: 'Text',
        text: /^qoq-fullstack · track-io — in-progress · 0\/1 master$/,
      })
    ).toBeDefined();
    expect((await ui.find({ type: 'Text', text: /^be / }))?.text).toBe(
      'be ▶ M1 · 1.2 signed link (1/2)'
    );
    expect((await ui.find({ type: 'Text', text: /^ui / }))?.text).toBe('ui ⏸ M1 waiting on be:M1');
    // telemetry answered "no changes needed": a row, and nothing to run.
    expect((await ui.find({ type: 'Text', text: /^telemetry/ }))?.text).toBe(
      'telemetry — no changes needed'
    );

    await ui.press({ key: 'details' });
    expect((await ui.find({ type: 'Text', text: /1\.1/ }))?.text).toBe('🟩 1.1 export endpoint');
    expect((await ui.find({ type: 'Text', text: /^🟦/ }))?.text).toBe('🟦 1.2 signed link');
    await ui.press({ key: 'details' });
    await ui.unmount();
  }
});

test('nothing draws before the session names a program', async ($, on) => {
  engine(on);
  await $.tool.call({ tool: 'Bash', command: 'ls' });
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' });

  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine');
  await ui.unmount();
});
