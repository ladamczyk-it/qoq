// Types for feature-state.mjs, which the plugin's hooks module imports.
export type NextMilestone = {
  id: string;
  name: string;
  file: string | null;
  status: string;
  runnable: boolean;
  waitingOn: string[];
};

export type FeatureReport = {
  feature: string;
  status: string;
  master: {
    id: string;
    name: string;
    status: string;
    dependsOn: string[];
    integration: string[];
    repos: { repo: string; id: string; status: string }[];
    integrationDue: boolean;
  }[];
  repos: {
    name: string;
    path: string;
    role: string;
    planDir: string | null;
    planStatus: string;
    next: NextMilestone | null;
  }[];
};

export declare const repoPlans: (brd: string) => Map<string, string>;

export declare const featureState: (input: {
  slug: string;
  feature: { repos?: { name: string; path: string; role: string }[] };
  brd: string;
  indexes: Record<string, string | undefined>;
}) => FeatureReport;
