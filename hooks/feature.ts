import type { EngineInterface } from 'claude-code';

import { featureState, repoPlans } from '../skills/qoq/scripts/feature-state.mjs';

import { parseTickets } from './plan';
import type { FeatureBoard } from './types';

// Reads a `qoq-fullstack` feature the way scripts/feature-status.mjs does, through
// the same shared core, so the band and the chief of staff never disagree about
// what may start. A missing file reads as undefined: a repo may have no plan yet.

export async function loadFeature(
  $: EngineInterface,
  root: string,
  slug: string
): Promise<FeatureBoard | null> {
  const read = (path: string) => $.fs.read(path).catch(() => undefined);
  const featureText = await read(`${root}/feature.json`);
  const brd = await read(`${root}/feature/${slug}/brd.md`);
  if (featureText === undefined || brd === undefined) {
    return null;
  }
  const feature = JSON.parse(featureText) as {
    repos?: { name: string; path: string; role: string }[];
  };
  const plans = repoPlans(brd);
  const repos = (feature.repos ?? []).filter((repo) => plans.has(repo.name));
  const indexes: Record<string, string | undefined> = {};
  for (const repo of repos) {
    const planDir = plans.get(repo.name);
    indexes[repo.name] =
      planDir === 'none' ? undefined : await read(`${root}/${repo.path}/${planDir}/index.md`);
  }
  const report = featureState({ slug, feature: { repos }, brd, indexes });

  const rows = [];
  for (const repo of report.repos) {
    const { next } = repo;
    const file = next?.file ? await read(`${root}/${repo.path}/${repo.planDir}/${next.file}`) : '';
    rows.push({
      name: repo.name,
      noChanges: repo.planStatus === 'none',
      milestone: next?.id ?? null,
      milestoneName: next?.name ?? '',
      runnable: next?.runnable ?? false,
      waitingOn: next?.waitingOn ?? [],
      tickets: parseTickets(file ?? ''),
    });
  }
  return {
    slug,
    status: report.status,
    master: report.master.map(({ id, name, status, integrationDue }) => ({
      id,
      name,
      status,
      integrationDue,
    })),
    repos: rows,
  };
}

// One line per repo: what it is doing now, or what it waits for.
export const repoLine = (repo: FeatureBoard['repos'][number]) => {
  if (repo.noChanges) {
    return `${repo.name} — no changes needed`;
  }
  if (!repo.milestone) {
    return `${repo.name} ✓ done`;
  }
  if (!repo.runnable) {
    return `${repo.name} ⏸ ${repo.milestone} waiting on ${repo.waitingOn.join(', ') || 'its plan'}`;
  }
  const live = repo.tickets.find((t) => t.status === 'in-progress');
  const done = repo.tickets.filter((t) => t.status === 'done').length;
  const count = `(${done}/${repo.tickets.length})`;
  if (live) {
    return `${repo.name} ▶ ${repo.milestone} · ${live.id} ${live.name} ${count}`;
  }
  // Every ticket committed, the milestone not yet delivered: its gates are running.
  return done > 0 && done === repo.tickets.length
    ? `${repo.name} ▶ ${repo.milestone} milestone gates ${count}`
    : `${repo.name} ▶ ${repo.milestone} ready ${count}`;
};
