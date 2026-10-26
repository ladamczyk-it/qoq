import { expect, test } from 'claude-code/testing';
import type { TestBody } from 'claude-code/testing';

import { PLAN } from './plan.fixture';

const BAND = {
  plugin: 'qoq',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 40,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const;

// Nothing sits beneath the plugin: these stand for the engine.
const engine = (on: Parameters<TestBody>[1]) => {
  on('tool.call', () => ({ result: {} }));
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e);
    return <Text>engine</Text>;
  });
};

test('nothing draws until the session touches an active plan', async ($, on) => {
  engine(on);
  on('fs.read', () => ({ value: PLAN.replace('in-progress', 'draft') }));

  await $.tool.call({ tool: 'Bash', command: 'ls' });
  await $.tool.call({ tool: 'Read', file_path: '/repo/plans/p.md' });
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' });

  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine');
  await ui.unmount();
});

test('the compact band shows tickets done and the share; Details lists each ticket', async ($, on) => {
  engine(on);
  on('fs.read', () => ({ value: PLAN }));

  await $.tool.call({ tool: 'Read', file_path: '/repo/plans/p.md' });

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface });
    expect((await ui.find({ type: 'Text', text: /tickets/ }))?.text).toBe('3/5 tickets · 60%');
    expect(
      await ui.find({ type: 'Text', text: /^qoq · Trip Tags — in-progress · 1\/2 milestones$/ })
    ).toBeDefined();

    await ui.press({ key: 'details' });
    expect((await ui.find({ type: 'Text', text: /^M2/ }))?.text).toBe('M2 Live');
    expect((await ui.find({ type: 'Text', text: /^delivered/ }))?.text).toBe(
      'delivered 2026-10-20'
    );
    expect((await ui.find({ type: 'Text', text: /1\.2/ }))?.text).toBe('🟩 1.2 Two words');
    expect((await ui.find({ type: 'Text', text: /2\.2/ }))?.text).toBe('🟦 2.2 Second');
    expect((await ui.find({ type: 'Text', text: /2\.3/ }))?.text).toBe('🟫 2.3 Third');

    await ui.press({ key: 'details' });
    expect(await ui.find({ type: 'Text', text: /^M2/ })).toBeUndefined();
    await ui.unmount();
  }
});

test('later tool calls reread the plan, so the band follows it', async ($, on) => {
  engine(on);
  let text = PLAN;
  on('fs.read', () => ({ value: text }));

  await $.tool.call({ tool: 'Read', file_path: '/repo/plans/p.md' });
  text = PLAN.replace('- **Status:** in-progress', '- **Status:** done');
  await $.tool.call({ tool: 'Bash', command: 'git commit' });
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' });

  expect((await ui.find({ type: 'Text', text: /tickets/ }))?.text).toBe('4/5 tickets · 80%');
  await ui.unmount();
});
