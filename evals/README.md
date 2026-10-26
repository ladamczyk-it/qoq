# qoq skill evals

`qoq-evals.json` is the skill-creator eval set. Each eval has a `prompt`, an
`expected_output`, `assertions` and `files`. Some also have a `setup` and a
`target`.

## Targets

- **`fixture-repo`** — `fixtures/repo/`, a small TypeScript service. Its default
  state:
  - exactly three findings, all in `src/lint/slugify.ts`: Prettier, ESLint
    `no-unused-vars`, and a Knip unused export, `titleCase`;
  - a green build and suite (no specs yet);
  - a complete `qoq:discovery` block in `CLAUDE.md` and `stats: false`;
  - one approved plan, `plans/2026-08-20-ratelimit.md`;
  - a spec at `docs/api-keys.md`.
- **`workspace`** — `fixtures/workspace/`, the `fullstack-plan` evals (37–42):
  a parent directory with no `.git` and no `qoq.config`, holding two repos:
  - `api/` — a `node:http` trips router over an in-memory store, `npm start`
    on `PORT` (default 3000);
  - `web/` — a React trips client calling same-origin `/trips`, built with
    `tsc` only (nothing serves it until the E2E milestone adds vite).

  Both build and pass `qoq --check`. Two planted findings for a review to
  catch: `api/src/trips/store.ts` `add` spreads the input after `id`, so a
  client can choose a trip's id, and api sends no CORS headers.

- **`this-repo`** — the qoq monorepo itself, in a throwaway worktree
  (`git worktree add`).
- **`agent`** — no repo: the prompt dispatches one agent directly against
  `fixtures/<agent>/`.
- An eval with no `target` has no fixture yet; its prompt describes a state
  nothing reproduces.

## Preparing `fixture-repo`

Run this once per run, in a fresh scratch directory, before the session starts:

```bash
cp -r <repo>/evals/fixtures/repo <scratch> && cd <scratch>
git init -q -b master && npm install
node <repo>/skills/qoq/scripts/sync-agents.mjs --project .   # skip for eval 19
# apply the eval's `setup`, if it has one
git add -A && git commit -qm fixture
```

Then open the session in `<scratch>` with the skill installed and send the
prompt. `sync-agents.mjs` registers the agents up front, so only eval 19 hits
the fresh-install question. The branch is `master` on purpose: the `execute`
evals assert that the run asks before working on the default branch.

`fixtures/repo-states/` holds later states that a `setup` copies in, for example
ticket 1.1 already delivered.

## Preparing `workspace`

```bash
evals/prepare-workspace.sh <empty scratch dir> <eval id>
```

It copies the workspace, overlays the eval's state from
`fixtures/workspace-states/` (`trip-tags-approved`: the manifest and both
component plans approved; `trip-tags-web-m1-delivered`: web's Milestone 1
archived), and makes each component its own repo on `master` with its
dependencies installed. Eval 41 leaves web on `feat/trip-tags`.

Then install the skill into `<dir>/.claude/skills/qoq` and run
`sync-agents.mjs --project <dir>`, and add `.claude/` to each component's
`.git/info/exclude`. The session opens at `<dir>`, except eval 41, which opens
at `<dir>/web`. Disable an installed `qoq` plugin for the run, or its older
copy of the skill answers instead.
