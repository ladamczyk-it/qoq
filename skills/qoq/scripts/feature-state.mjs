// The feature's state, from file texts the caller has already read: the
// chief of staff's status script reads them from disk, and the plugin's band
// reads them through the engine. One copy of the rules, so the two never
// disagree about what may start.
//
// No imports: the plugin's hooks module imports this file, and it has no Node.

// The first markdown table whose header has every one of `columns`, as an array
// of row objects keyed by header text. Tables are found by header, not position,
// so a plan that gained a column (Serves, External) still parses.
export const table = (source, columns) => {
  const lines = source.split('\n');

  for (let i = 0; i < lines.length - 1; i += 1) {
    const cells = (line) =>
      line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim());

    if (!lines[i].trim().startsWith('|') || !/^\|?\s*:?-{3}/.test(lines[i + 1].trim())) {
      continue;
    }

    const header = cells(lines[i]);

    if (!columns.every((column) => header.includes(column))) {
      continue;
    }

    const rows = [];

    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j += 1) {
      const row = cells(lines[j]);
      rows.push(Object.fromEntries(header.map((name, k) => [name, row[k] ?? ''])));
    }

    return rows;
  }

  return [];
};

// `[Name](m1-x.md)` → `Name`. Two passes keep each regex linear.
export const label = (cell) => cell.replace(/\]\([^)]*\)/g, '').replace(/\[/g, '');
export const list = (cell) =>
  !cell || /^(none|—|-)$/i.test(cell.trim())
    ? []
    : cell
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
export const delivered = (status) => status.startsWith('delivered');
export const closed = (status) => delivered(status) || status.startsWith('withdrawn');

// `[Name](m1-x.md)` → `m1-x.md`; null when the cell links nothing.
const linkTarget = (cell) => {
  const start = cell.indexOf('](');
  const end = cell.indexOf(')', start);
  return start === -1 || end === -1 ? null : cell.slice(start + 2, end);
};

export const repoPlans = (brd) =>
  new Map(table(brd, ['Repo', 'Plan']).map((row) => [row.Repo, label(row.Plan).replace(/`/g, '')]));

// `indexes`: repo name → that repo's plan index text, or undefined when unread.
export const featureState = ({ slug, feature, brd, indexes }) => {
  const featureStatus = brd.match(/\*\*Feature status:\*\*\s*([\w-]+)/)?.[1] ?? 'unknown';

  const master = table(brd, ['#', 'Milestone', 'Status', 'Depends on']).map((row) => ({
    id: row['#'],
    name: label(row.Milestone),
    status: row.Status,
    dependsOn: list(row['Depends on']),
    integration: list(row.Integration ?? ''),
  }));
  const masterById = new Map(master.map((m) => [m.id, m]));

  const planPaths = repoPlans(brd);

  const repos = (feature.repos ?? []).map((repo) => {
    // `none`: the repo answered "no changes needed" and the user approved it.
    const cell = planPaths.get(repo.name);
    const noChanges = cell === 'none';
    const planDir = noChanges ? undefined : cell;
    const index = planDir ? indexes[repo.name] : undefined;

    return {
      ...repo,
      planDir: planDir ?? null,
      planStatus: noChanges
        ? 'none'
        : (index?.match(/\*\*Plan status:\*\*\s*([\w-]+)/)?.[1] ?? 'missing'),
      milestones:
        index === undefined
          ? []
          : table(index, ['#', 'Milestone', 'Status', 'Depends on']).map((row) => ({
              id: row['#'],
              name: label(row.Milestone),
              file: linkTarget(row.Milestone),
              status: row.Status,
              dependsOn: list(row['Depends on']),
              serves: list(row.Serves ?? ''),
            })),
    };
  });
  const repoByName = new Map(repos.map((repo) => [repo.name, repo]));

  // `be:M2` → that repo's M2 status; `M1` → this repo's own. Unknown is never
  // delivered: a typo must block, not wave a milestone through.
  const depDelivered = (owner, dep) => {
    const [repoName, id] = dep.includes(':') ? dep.split(':') : [owner.name, dep];
    const milestone = repoByName.get(repoName)?.milestones.find((m) => m.id === id);
    return milestone !== undefined && delivered(milestone.status);
  };

  const waitsOf = (repo, milestone) => [
    ...new Set([
      ...milestone.dependsOn.filter((dep) => !depDelivered(repo, dep)),
      // A milestone serving M<k> waits for every master milestone M<k> depends on
      // to pass its integration check, not merely for the repo work under it.
      ...milestone.serves.flatMap((id) =>
        (masterById.get(id)?.dependsOn ?? []).filter(
          (dep) => !delivered(masterById.get(dep)?.status ?? '')
        )
      ),
    ]),
  ];

  for (const repo of repos) {
    const open = repo.milestones.filter((m) => !closed(m.status));
    const planned = repo.planStatus !== 'draft' && repo.planStatus !== 'missing';
    // One milestone at a time: one already started stays next. Otherwise the
    // first in row order whose dependencies are delivered — a blocked one is
    // skipped, not waited on, so independent work runs first.
    const pick =
      open.find((m) => m.status.startsWith('in-progress')) ??
      open.find((m) => waitsOf(repo, m).length === 0) ??
      open[0];

    if (pick === undefined) {
      repo.next = null;
      continue;
    }

    const waitingOn = waitsOf(repo, pick);

    repo.next = {
      id: pick.id,
      name: pick.name,
      file: pick.file,
      status: pick.status,
      runnable: planned && waitingOn.length === 0,
      waitingOn,
    };
  }

  for (const m of master) {
    m.repos = repos.flatMap((repo) =>
      repo.milestones
        .filter((rm) => rm.serves.includes(m.id))
        .map((rm) => ({ repo: repo.name, id: rm.id, status: rm.status }))
    );
    m.integrationDue =
      !delivered(m.status) && m.repos.length > 0 && m.repos.every((rm) => delivered(rm.status));
  }

  return {
    feature: slug,
    status: featureStatus,
    master: master.map(
      ({ id, name, status, dependsOn, integration, repos: served, integrationDue }) => ({
        id,
        name,
        status,
        dependsOn,
        integration,
        repos: served,
        integrationDue,
      })
    ),
    repos: repos.map(({ name, path, role, planDir, planStatus, next }) => ({
      name,
      path,
      role,
      planDir,
      planStatus,
      next,
    })),
  };
};
