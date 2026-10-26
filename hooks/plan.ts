import type { Board, Milestone, Ticket } from './types';

// Reads a plan shaped like skills/qoq/assets/plan-template.md: the title, the
// plan status, each delivered milestone's summary under `## Completed` (its
// `**Tickets:**` line, all done) and each live milestone's tickets with their
// `Status`. `### Milestone N — Definition of done` has no colon and never
// matches. Null when the file has no plan status: not a plan.
export const parsePlan = (text: string): Board | null => {
  const status = /^\*\*Plan status:\*\*\s*(\S+)/m.exec(text)?.[1];
  if (!status) {
    return null;
  }
  const title = (/^# (.+)$/m.exec(text)?.[1] ?? 'plan').trim().replace(/ Implementation Plan$/, '');
  const milestones: Milestone[] = [];
  let milestone: Milestone | undefined;
  let ticket: Ticket | undefined;

  for (const line of text.split('\n').map((l) => l.trimEnd())) {
    const opened =
      /^### Milestone (\d+): (.+?) — delivered (\S+)$/.exec(line) ??
      /^## Milestone (\d+): (.+)$/.exec(line);
    if (opened) {
      const [, number = '', name = '', delivered = null] = opened;
      milestone = { number: Number(number), name, delivered, tickets: [] };
      milestones.push(milestone);
      ticket = undefined;
    } else if (line.startsWith('## ')) {
      milestone = undefined;
      ticket = undefined;
    } else if (milestone?.delivered) {
      const tickets = /^\*\*Tickets:\*\*(.+)$/.exec(line)?.[1];
      if (tickets) {
        // `<id> <title> \`<commit>\``, the commit dropped.
        milestone.tickets = tickets.split(' · ').map((entry) => {
          const [id = '', ...name] = entry
            .replaceAll(/`[^`]*`/g, '')
            .trim()
            .split(' ');
          return { id, name: name.join(' '), status: 'done' };
        });
      }
    } else if (milestone) {
      const found = /^### Ticket (\d+\.\d+): (.+)$/.exec(line);
      const ticketStatus = /^- \*\*Status:\*\*\s*([\w-]+)/.exec(line)?.[1];
      if (found) {
        ticket = { id: found[1] ?? '', name: found[2] ?? '', status: 'todo' };
        milestone.tickets.push(ticket);
      } else if (ticket && ticketStatus) {
        ticket.status = ticketStatus;
      }
    }
  }

  return { title, status, milestones };
};
