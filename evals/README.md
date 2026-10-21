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
