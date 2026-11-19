export type Ticket = { id: string; name: string; status: string };

export type Milestone = {
  number: number;
  name: string;
  delivered: string | null;
  tickets: Ticket[];
};

// A plan as hooks/plan.ts reads it.
export type Board = { title: string; status: string; milestones: Milestone[] };

// One repo of a feature, as hooks/feature.ts reads it.
export type RepoRow = {
  name: string;
  // The repo answered "no changes needed": nothing to run.
  noChanges: boolean;
  // `M1`, or null once every milestone is closed.
  milestone: string | null;
  milestoneName: string;
  runnable: boolean;
  waitingOn: string[];
  tickets: Ticket[];
};

export type MasterRow = { id: string; name: string; status: string; integrationDue: boolean };

// A `qoq-fullstack` feature, rebuilt from feature.json, the BRD and each repo's plan.
export type FeatureBoard = { slug: string; status: string; master: MasterRow[]; repos: RepoRow[] };

declare module 'claude-code' {
  interface PluginState {
    qoq: {
      board: Board | null;
      details: boolean;
      feature: FeatureBoard | null;
      featureDetails: boolean;
    };
  }
}
