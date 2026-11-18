import type { Board, Milestone, Ticket } from './types';

// Reads a plan shaped like skills/qoq/assets/plan-template.md: a directory
// whose `index.md` holds the title, the plan status and one `## Milestones`
// row per milestone, linking its `m<N>-<slug>.md`. Ticket statuses live only in
// those milestone files.

type Row = Omit<Milestone, 'tickets'> & { file: string; withdrawn: boolean };

// Null when the file has no plan status: not a plan.
export const parseIndex = (text: string) => {
  const status = /^\*\*Plan status:\*\*\s*(\S+)/m.exec(text)?.[1];
  if (!status) {
    return null;
  }
  const title = (/^# (.+)$/m.exec(text)?.[1] ?? 'plan').trim().replace(/ Implementation Plan$/, '');
  const rows: Row[] = [];
  // `| M1 | [Name](m1-slug.md) | delivered 2026-10-20 | … |`
  const ROW = /^\|\s*M(\d+)\s*\|\s*\[(.+?)\]\((m\d+-[^)\s]+\.md)\)\s*\|\s*([^|]*?)\s*\|/gm;
  for (const [, number = '', name = '', file = '', cell = ''] of text.matchAll(ROW)) {
    rows.push({
      number: Number(number),
      name,
      file,
      delivered: /^delivered\s+(\S+)/.exec(cell)?.[1] ?? null,
      withdrawn: cell.startsWith('withdrawn'),
    });
  }
  return { title, status, rows };
};

// `### Milestone N — Definition of done` and `#### Execution` never match.
export const parseTickets = (text: string): Ticket[] => {
  const tickets: Ticket[] = [];
  let ticket: Ticket | undefined;
  for (const line of text.split('\n').map((l) => l.trimEnd())) {
    const found = /^### Ticket (\d+\.\d+): (.+)$/.exec(line);
    const status = /^- \*\*Status:\*\*\s*([\w-]+)/.exec(line)?.[1];
    if (found) {
      ticket = { id: found[1] ?? '', name: found[2] ?? '', status: 'todo' };
      tickets.push(ticket);
    } else if (/^#{1,3} /.test(line)) {
      ticket = undefined;
    } else if (ticket && status) {
      ticket.status = status;
    }
  }
  return tickets;
};

// Withdrawn milestones are left off: their tickets will never be done.
export const parsePlan = (index: string, files: Record<string, string>): Board | null => {
  const parsed = parseIndex(index);
  if (!parsed) {
    return null;
  }
  const milestones = parsed.rows
    .filter((row) => !row.withdrawn)
    .map(({ number, name, delivered, file }) => ({
      number,
      name,
      delivered,
      tickets: parseTickets(files[file] ?? ''),
    }));
  return { title: parsed.title, status: parsed.status, milestones };
};
