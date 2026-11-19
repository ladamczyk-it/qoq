import { atom, read, update } from 'claude-code';
import type { EngineInterface, Register } from 'claude-code';

import { parseIndex, parsePlan } from './plan';
import { loadFeature, repoLine } from './feature';
import type { Board, FeatureBoard, Ticket } from './types';

// The `qoq execute` board, above the prompt. The skill knows nothing of it.
//
// Both plugins, `qoq` and `qoq-fullstack`, are this one repository, so both load
// this module. Only the `qoq` copy draws, since every `qoq-fullstack` install has
// `qoq` too. Two copies would stack two bands. It draws the plan board in a
// session working a plan, and the feature board in a chief of staff's session,
// which names a feature (the protocol, like the status script, is `qoq`'s).
//
// Once the session reads or edits any file of a `plans/<plan>/` directory
// whose index is an approved, in-progress or complete plan, the band rereads
// the index and its milestone files after every later tool call, so it follows
// the plan as tickets move. Compact: the plan, tickets
// done and the percentage. Details: one column per milestone, side by side,
// its tickets one per line.

const board = atom({ plugin: 'qoq', key: 'board' } as const, null);
const details = atom({ plugin: 'qoq', key: 'details' } as const, false);
const feature = atom({ plugin: 'qoq', key: 'feature' } as const, null);
const featureDetails = atom({ plugin: 'qoq', key: 'featureDetails' } as const, false);

const FULLSTACK = 'qoq-fullstack';
// The chief of staff reads the BRD, or runs the status script on a feature.
const BRD_FILE = /^(.*)\/feature\/([^/]+)\/brd\.md$/;
// Any feature script: qoq's feature-status.mjs, or qoq-fullstack's status.mjs and schedule.mjs.
const STATUS_RUN = /\.mjs\s+--root\s+(\S+)\s+--feature\s+(\S+)/;

// `--root .` names the folder the command ran in. Pin it to an absolute path
// now: a later `cd` moves the shell, and a relative root would then miss
// feature.json and clear the band. Run after the command, so a `cd` it led
// with has already moved the cwd.
const absolute = (cwd: string, path: string) => {
  const parts: string[] = [];
  for (const part of `${cwd}/${path}`.split('/')) {
    if (part === '..') {
      parts.pop();
    } else if (part && part !== '.') {
      parts.push(part);
    }
  }
  return `/${parts.join('/')}`;
};

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

// Module variables: a reload starts them over, and the next tool call that
// names a plan or a feature sets them again.
let source: { root: string; slug: string } | undefined;
let planDir: string | undefined;

export const register: Register = (on) => {
  on('tool.call', async ($, e, next) => {
    const result = await next(e);
    if ($.plugin.name === FULLSTACK) {
      return result;
    }
    {
      const touched =
        e.tool === 'Read' || e.tool === 'Edit' || e.tool === 'Write'
          ? BRD_FILE.exec(e.file_path)
          : null;
      const ran = e.tool === 'Bash' ? STATUS_RUN.exec(e.command) : null;
      const found = touched ?? ran;
      if (found?.[1] && found[2]) {
        const root = found[1].replace(/^["']|["']$/g, '');
        source = {
          root: root.startsWith('/') ? root : absolute(await $.session.cwd(), root),
          slug: found[2],
        };
      }
      if (source) {
        const { root, slug } = source;
        const loaded = await loadFeature($, root, slug).catch(() => null);
        await update($, feature, () => loaded);
        // A chief of staff's session: the feature board, never a plan's.
        return result;
      }
    }
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
    if ($.plugin.name === FULLSTACK) {
      return next(e);
    }
    const live: FeatureBoard | null = await read($, feature);
    if (!e.props.hasSurvey && typeof live?.slug === 'string') {
      const current = live;
      const below = await next(e).catch(() => undefined);
      const isOpen = await read($, featureDetails);
      const toggle = () => update($, featureDetails, (open) => !open);
      const delivered = current.master.filter((m) => m.status.startsWith('delivered')).length;
      const due = current.master.filter((m) => m.integrationDue).map((m) => m.id);
      const head = `qoq-fullstack · ${current.slug} — ${current.status} · ${delivered}/${current.master.length} master${due.length ? ` · integration due ${due.join(', ')}` : ''}`;

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
            {current.repos.map((r) => (
              <Box key={`r-${r.name}`} flexDirection="column" width={COLUMN}>
                <Text bold wrap="truncate-end">
                  {repoLine(r)}
                </Text>
                {r.milestone ? (
                  <Text dimColor wrap="truncate-end">
                    {r.milestone} {r.milestoneName}
                  </Text>
                ) : null}
                {r.tickets.map((t) => (
                  <Text wrap="truncate-end">
                    {square(t)} {t.id} {t.name}
                  </Text>
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" width={e.props.bodyColumns}>
          <Box flexDirection="row" gap={2}>
            <Text>{head}</Text>
            <Box flexGrow={1} />
            <Button key="details" hotkey="d" plain label="Details" onPress={toggle} />
          </Box>
          {current.repos.map((r) => (
            <Text wrap="truncate-end">{repoLine(r)}</Text>
          ))}
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
    }
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
