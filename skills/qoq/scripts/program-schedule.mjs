// The delivery order for each repo of a program, chosen so that the repos
// running in parallel wait on each other as little as possible.
//
// Each repo delivers one milestone at a time, in its Milestones row order,
// skipping any whose dependencies aren't delivered yet. Row order is therefore
// the only thing to choose. A hard dependency (Depends on, `<repo>:M<N>`, a
// master milestone's integration) is never broken. Only the order between
// milestones that don't depend on each other moves.
//
// The run is simulated with each milestone's ticket count as its duration. When
// a repo is free, it starts the ready milestone with the most work waiting on it
// in other repos, so the piece someone else needs goes first. Ties keep the
// planned order. The result is kept only if it waits less than the planned order.
//
// No imports beyond the core: the same rules as program-state.mjs.

import { closed, delivered, label, list, repoPlans, table } from './program-state.mjs';

const milestonesOf = (index) =>
  table(index ?? '', ['#', 'Milestone', 'Status', 'Depends on']).map((row) => ({
    id: row['#'],
    name: label(row.Milestone),
    status: row.Status,
    dependsOn: list(row['Depends on']),
    serves: list(row.Serves ?? ''),
  }));

// `tickets`: repo name → milestone id → ticket count.
export const schedule = ({ program, brd, indexes, tickets }) => {
  const plans = repoPlans(brd);
  const masterDeps = new Map(
    table(brd, ['#', 'Milestone', 'Status', 'Depends on']).map((row) => [
      row['#'],
      list(row['Depends on']),
    ])
  );
  const repos = (program.repos ?? [])
    .filter((repo) => plans.has(repo.name) && plans.get(repo.name) !== 'none')
    .map((repo) => ({ name: repo.name, milestones: milestonesOf(indexes[repo.name]) }));

  const key = (repo, id) => `${repo}:${id}`;
  const nodes = new Map();
  for (const repo of repos) {
    repo.milestones.forEach((m, order) => {
      nodes.set(key(repo.name, m.id), {
        repo: repo.name,
        id: m.id,
        order,
        duration: Math.max(1, tickets[repo.name]?.[m.id] ?? 1),
        done: closed(m.status),
        started: m.status.startsWith('in-progress'),
        deps: m.dependsOn.map((dep) => (dep.includes(':') ? dep : key(repo.name, dep))),
        serves: m.serves,
      });
    });
  }
  // A master milestone counts as delivered once every repo milestone serving it is.
  const servers = (masterId) => [...nodes.values()].filter((n) => n.serves.includes(masterId));
  for (const node of nodes.values()) {
    const viaMaster = node.serves.flatMap((id) =>
      (masterDeps.get(id) ?? []).flatMap((dep) => servers(dep).map((n) => key(n.repo, n.id)))
    );
    node.deps = [...new Set([...node.deps, ...viaMaster])];
  }

  // Work in other repos that waits, directly or not, on each milestone.
  const dependents = new Map([...nodes.keys()].map((k) => [k, []]));
  for (const [k, node] of nodes) {
    for (const dep of node.deps) {
      dependents.get(dep)?.push(k);
    }
  }
  const weight = new Map();
  for (const [k, node] of nodes) {
    const seen = new Set();
    const stack = [...(dependents.get(k) ?? [])];
    while (stack.length) {
      const next = stack.pop();
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(...(dependents.get(next) ?? []));
      }
    }
    weight.set(
      k,
      [...seen]
        .filter((s) => nodes.get(s).repo !== node.repo)
        .reduce((sum, s) => sum + nodes.get(s).duration, 0)
    );
  }

  const simulate = (prefer) => {
    const finish = new Map([...nodes].filter(([, n]) => n.done).map(([k]) => [k, 0]));
    const queue = new Map(
      repos.map((r) => [
        r.name,
        r.milestones.map((m) => key(r.name, m.id)).filter((k) => !finish.has(k)),
      ])
    );
    const order = new Map(repos.map((r) => [r.name, []]));
    const busyUntil = new Map(repos.map((r) => [r.name, 0]));
    const idle = new Map(repos.map((r) => [r.name, 0]));
    let t = 0;
    const ready = (k) => nodes.get(k).deps.every((d) => finish.has(d) && finish.get(d) <= t);
    // A free repo starts its in-progress milestone, else the preferred ready one.
    const startNext = (repo) => {
      const left = queue.get(repo.name);
      const started = left.find((k) => nodes.get(k).started && ready(k));
      const [pick] = started ? [started] : left.filter(ready).sort(prefer);
      if (pick === undefined) {
        return;
      }
      left.splice(left.indexOf(pick), 1);
      order.get(repo.name).push(nodes.get(pick).id);
      busyUntil.set(repo.name, t + nodes.get(pick).duration);
      finish.set(pick, t + nodes.get(pick).duration);
    };
    const free = (repo) => busyUntil.get(repo.name) <= t && queue.get(repo.name).length > 0;

    for (let guard = 0; guard < 10_000; guard += 1) {
      repos.filter(free).forEach(startNext);
      const events = [...busyUntil.values()].filter((b) => b > t);
      if (events.length === 0) {
        break;
      }
      const nextT = Math.min(...events);
      for (const repo of repos.filter(free)) {
        idle.set(repo.name, idle.get(repo.name) + (nextT - t));
      }
      t = nextT;
    }
    const stuck = [...queue.values()].flat();
    return {
      order,
      idle,
      span: Math.max(0, ...finish.values()),
      stuck,
      waited: [...idle.values()].reduce((a, b) => a + b, 0),
    };
  };

  const planned = simulate((a, b) => nodes.get(a).order - nodes.get(b).order);
  const best = simulate(
    (a, b) => weight.get(b) - weight.get(a) || nodes.get(a).order - nodes.get(b).order
  );
  const better =
    best.stuck.length === 0 &&
    (best.span < planned.span || (best.span === planned.span && best.waited < planned.waited));
  const chosen = better ? best : planned;

  return {
    span: { planned: planned.span, chosen: chosen.span },
    stuck: chosen.stuck,
    repos: repos.map((repo) => {
      const doneIds = repo.milestones
        .filter((m) => closed(m.status) || delivered(m.status))
        .map((m) => m.id);
      const scheduled = [...doneIds, ...chosen.order.get(repo.name)];
      // Anything the run never reached keeps its planned place, at the end.
      const proposed = [
        ...scheduled,
        ...repo.milestones.map((m) => m.id).filter((id) => !scheduled.includes(id)),
      ];
      const current = repo.milestones.map((m) => m.id);
      return {
        name: repo.name,
        order: proposed,
        reorder: proposed.join() !== current.join(),
        idle: chosen.idle.get(repo.name),
      };
    }),
  };
};
