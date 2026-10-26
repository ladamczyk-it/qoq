import { atom, read, update } from 'claude-code';
import type { EngineInterface, Register } from 'claude-code';

import { parsePlan } from './plan';
import type { Board, Ticket } from './types';

// The `qoq execute` board, above the prompt. The skill knows nothing of it.
//
// Once the session reads or edits a `plans/*.md` that is an approved,
// in-progress or complete plan, the band rereads that file after every later
// tool call, so it follows the plan as tickets move. Compact: the plan, tickets
// done and the percentage. Details: one column per milestone, side by side,
// its tickets one per line.

const board = atom({ plugin: 'qoq', key: 'board' } as const, null);
const details = atom({ plugin: 'qoq', key: 'details' } as const, false);

const PLAN_FILE = /(?:^|\/)plans\/[^/]+(?<!\.completed)\.md$/;
const SHOWN = new Set(['approved', 'in-progress', 'complete']);
const SQUARES: Record<string, string> = { done: '🟩', 'in-progress': '🟦', blocked: '🟨' };
const LEGEND = '🟩 done · 🟦 in progress · 🟨 blocked · 🟫 to do';
const COLUMN = 34;

const square = (ticket: Ticket) => SQUARES[ticket.status] ?? '🟫';

export const tally = ({ milestones }: Board) => {
  const tickets = milestones.flatMap((m) => m.tickets);
  const done = tickets.filter((t) => t.status === 'done').length;
  return {
    delivered: milestones.filter((m) => m.delivered).length,
    done,
    total: tickets.length,
    percent: tickets.length ? Math.round((done / tickets.length) * 100) : 0,
  };
};

// Null when the file isn't a plan the band shows: a draft, or not a plan.
async function load($: EngineInterface, path: string) {
  const plan = parsePlan(await $.fs.read(path));
  return plan && SHOWN.has(plan.status) ? plan : null;
}

export const register: Register = (on) => {
  let planPath: string | undefined;

  on('tool.call', async ($, e, next) => {
    const result = await next(e);
    const touched =
      e.tool === 'Read' || e.tool === 'Edit' || e.tool === 'Write' ? e.file_path : undefined;
    if (touched && touched !== planPath && PLAN_FILE.test(touched)) {
      const plan = await load($, touched).catch(() => null);
      if (plan) {
        planPath = touched;
        await update($, board, () => plan);
      }
    } else if (planPath) {
      const plan = await load($, planPath).catch(() => null);
      await update($, board, () => plan);
    }
    return result;
  }).catch(($, e, next) => next(e));

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, board);
    // A board an earlier version stored has no title: wait for a refresh.
    if (e.props.hasSurvey || typeof current?.title !== 'string') {
      return next(e);
    }
    // Other mods share this slot: draw theirs below instead of replacing it.
    const below = await next(e).catch(() => undefined);
    const isOpen = await read($, details);
    const toggle = () => update($, details, (open) => !open);
    const { delivered, done, total, percent } = tally(current);
    const head = `qoq · ${current.title} — ${current.status} · ${delivered}/${current.milestones.length} milestones`;

    const { Box, Button, Text } = $.ui.resolve(e);
    const mine = isOpen ? (
      <Box flexDirection="column" gap={1} width={e.props.bodyColumns}>
        <Box flexDirection="row" gap={2}>
          <Text>{head}</Text>
          <Text dimColor>{LEGEND}</Text>
          <Box flexGrow={1} />
          <Button key="details" hotkey="d" plain label="Less" onPress={toggle} />
        </Box>
        <Box flexDirection="row" flexWrap="wrap" columnGap={3}>
          {current.milestones.map((m) => (
            <Box key={`m${m.number}`} flexDirection="column" width={COLUMN}>
              <Text bold wrap="truncate-end">
                M{m.number} {m.name}
              </Text>
              <Text dimColor>
                {m.delivered
                  ? `delivered ${m.delivered}`
                  : `${m.tickets.filter((t) => t.status === 'done').length}/${m.tickets.length}`}
              </Text>
              {m.tickets.map((t) => (
                <Text wrap="truncate-end">
                  {square(t)} {t.id} {t.name}
                </Text>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    ) : (
      <Box flexDirection="row" gap={2} width={e.props.bodyColumns}>
        <Text>{head}</Text>
        <Text>
          {done}/{total} tickets · {percent}%
        </Text>
        <Box flexGrow={1} />
        <Button key="details" hotkey="d" plain label="Details" onPress={toggle} />
      </Box>
    );

    return below ? (
      <Box flexDirection="column">
        {mine}
        {below}
      </Box>
    ) : (
      mine
    );
  });
};
