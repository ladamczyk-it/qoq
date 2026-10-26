export type Ticket = { id: string; name: string; status: string };

export type Milestone = {
  number: number;
  name: string;
  delivered: string | null;
  tickets: Ticket[];
};

// A plan as hooks/plan.ts reads it.
export type Board = { title: string; status: string; milestones: Milestone[] };

declare module 'claude-code' {
  interface PluginState {
    qoq: { board: Board | null; details: boolean };
  }
}
