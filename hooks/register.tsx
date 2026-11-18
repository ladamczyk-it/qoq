import { atom, read, update } from 'claude-code';
import type { EngineInterface, Register } from 'claude-code';

import { parseIndex, parsePlan } from './plan';
import type { Board, Ticket } from './types';

// The `qoq execute` board, above the prompt. The skill knows nothing of it.
//
// Once the session reads or edits any file of a `plans/<plan>/` directory
// whose index is an approved, in-progress or complete plan, the band rereads
// the index and its milestone files after every later tool call, so it follows
// the plan as tickets move. Compact: the plan, tickets
// done and the percentage. Details: one column per milestone, side by side,
// its tickets one per line.

const board = atom({ plugin: 'qoq', key: 'board' } as const, null);
const details = atom({ plugin: 'qoq', key: 'details' } as const, false);

// `plans/<plan>/index.md` or `plans/<plan>/m<N>-<slug>.md`; group 1 is the directory.
const PLAN_FILE = /^(.*(?:^|\/)plans\/[^/]+)\/(?:index|m\d+-[^/]+)\.md$/;
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

// Null when the directory isn't a plan the band shows: a draft, or not a plan.
// The index names the milestone files, so nothing lists the directory.
async function load($: EngineInterface, dir: string) {
  const index = await $.fs.read(`${dir}/index.md`);
  const files: Record<string, string> = {};
  for (const { file } of parseIndex(index)?.rows ?? []) {
    files[file] = await $.fs.read(`${dir}/${file}`).catch(() => '');
  }
  const plan = parsePlan(index, files);
  return plan && SHOWN.has(plan.status) ? plan : null;
}

export const register: Register = (on) => {
  let planDir: string | undefined;

  on('tool.call', async ($, e, next) => {
    const result = await next(e);
    const touched =
      e.tool === 'Read' || e.tool === 'Edit' || e.tool === 'Write' ? e.file_path : undefined;
    const dir = touched ? PLAN_FILE.exec(touched)?.[1] : undefined;
    if (dir && dir !== planDir) {
      const plan = await load($, dir).catch(() => null);
      if (plan) {
        planDir = dir;
        await update($, board, () => plan);
      }
    } else if (planDir) {
      const plan = await load($, planDir).catch(() => null);
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
