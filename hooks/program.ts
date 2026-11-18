import type { EngineInterface } from 'claude-code';

import { programState, repoPlans } from '../skills/qoq/scripts/program-state.mjs';

import { parseTickets } from './plan';
import type { ProgramBoard } from './types';

// Reads a `qoq-fullstack` program the way scripts/program-status.mjs does, through
// the same shared core, so the band and the chief of staff never disagree about
// what may start. A missing file reads as undefined: a repo may have no plan yet.

export async function loadProgram(
  $: EngineInterface,
  root: string,
  slug: string
): Promise<ProgramBoard | null> {
  const read = (path: string) => $.fs.read(path).catch(() => undefined);
  const programText = await read(`${root}/program.json`);
  const brd = await read(`${root}/program/${slug}/brd.md`);
  if (programText === undefined || brd === undefined) {
    return null;
  }
  const program = JSON.parse(programText) as {
    repos?: { name: string; path: string; role: string }[];
  };
  const plans = repoPlans(brd);
  const repos = (program.repos ?? []).filter((repo) => plans.has(repo.name));
  const indexes: Record<string, string | undefined> = {};
  for (const repo of repos) {
    const planDir = plans.get(repo.name);
    indexes[repo.name] =
      planDir === 'none' ? undefined : await read(`${root}/${repo.path}/${planDir}/index.md`);
  }
  const report = programState({ slug, program: { repos }, brd, indexes });

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
export const repoLine = (repo: ProgramBoard['repos'][number]) => {
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
  return live
    ? `${repo.name} ▶ ${repo.milestone} · ${live.id} ${live.name} (${done}/${repo.tickets.length})`
    : `${repo.name} ▶ ${repo.milestone} ready (${done}/${repo.tickets.length})`;
};
