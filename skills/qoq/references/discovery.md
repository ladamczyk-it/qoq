# Discovery — the record every command starts from

One cached JSON file, six consumers, and an agent that runs only when the file
can't be trusted. **No command re-derives any of this.**

`entry.mjs` decides whether the record is current and what to do if it isn't
(`SKILL.md`). This file is what the record holds, and what to do with the answers
that came from a person.

## Who reads what

| Command         | Fields it needs                                                 |
| --------------- | --------------------------------------------------------------- |
| `fix`           | `run`, `check`, `test:one`, `build`                             |
| `refactor`      | the same                                                        |
| `bump`          | `run`, `test`, `build`                                          |
| `plan`          | `test`, `build` — copied into the plan's Commands header        |
| `execute`       | `test`, `build` — for the milestone gate                        |
| `test`          | `test:one`, `test`, `runner`, `globals`, `react`, `conventions` |
| `qoq-developer` | all of it                                                       |

Nobody passes anything but the project root, and nobody gets a different answer
than anybody else.

Which review lenses are installed is deliberately **not** here. That answer lives
in the available-skills list of whichever thread needs it, which is always
current and costs nothing to read — `refactor` looks `ponytail-review` up when
assessment 3 comes round.

## The record

```
node_modules/@ladamczyk/qoq-cli/bin/qoq-skill-discovery.json
```

The record lives and dies with the installed CLI: `npm install` wipes it and
discovery re-runs.

**Written for an agent, not a human.** Nothing in it that isn't read back, no
commentary fields.

```json
{
  "hash": "9f2c41ab77d0e315",
  "run": "npx qoq",
  "check": "--check --json",
  "test": "npm test",
  "test:one": "npm run test -- {file}",
  "build": "npm run build",
  "runner": "vitest",
  "globals": true,
  "react": true,
  "conventions": "./testing-gate.md"
}
```

A full check is `<run> <check>`, the two fields concatenated. Three fields need
saying twice.

`hash` covers two inputs, and of each one only the part the record's answers came
from:

- `package.json`'s **`scripts` block** — every command field quotes one verbatim,
  and renaming one moves no lockfile at all
- the **watched dependencies** — the qoq CLI, `vitest`/`jest`,
  `@testing-library/react` — by name in `package.json`'s `dependencies` and
  `devDependencies`, and by the lines naming them in the project's lockfile
  (`package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `yarn.lock`, in
  that order). `run`, `check`, `runner` and `react` are read off those.

Nothing else in those files, versions included: a `version` bump and an unrelated
transitive dependency each moved the hash without changing a word of the record.
`scripts/discovery-check.mjs` owns computing it, and the agent stamps the value
it was handed rather than deriving its own — two implementations that disagree
mean a record that never matches and an agent dispatched on every run.

There is no `lint` field — linting is what `run` does.

`test:one` carries a `{file}` placeholder. It exists because most checks in this
skill are narrow — one spec just written, one file just fixed — and re-running a
whole suite to learn about one file is the difference between a loop that's
usable and one that isn't. `bump` deliberately never uses it: after a dependency
moves, "which tests could this have broken" isn't answerable.

## What a caller needs to know about the outcome

Verification, derivation and self-repair are the agent's — `agents/qoq-discovery.md`.

**A missing CLI stops the whole run**, and `discovery-check.mjs` catches it
before any agent is dispatched. Every command's spine is `fix`, and `fix` is the
qoq CLI; without it they'd degrade into advice while still calling themselves a
gate.

**A repaired record is announced, at the end of the run.** The agent fixes stale
fields without asking — no permission is needed to re-derive a fact it already
knows how to derive — but a silent rewrite of the file every command trusts is
exactly what should never happen unannounced:

```
Discovery record updated:
  test:one   npm run test -- {file}  →  npm run test:execute -- {file}
```

A record that verified clean produces no notice at all, and a record the script
accepted was never opened by an agent in the first place.

## An answered question gets written down outside `node_modules`

The record dies with the CLI package, so an answer must not live only there.
`npm install` wipes it, the next run re-discovers, hits the same ambiguity, and
asks the same question. A user who has said once that the single-file test
command is `npm run test:execute -- {file}` should never be asked again.

So when the caller asks the user something discovery couldn't resolve, it
**records the answer in the project's own docs before re-dispatching** —
`CLAUDE.md` if there is one, else `AGENTS.md`, else `README.md`, in that order,
and never a new file if one of those exists. A short marked block, so it's
updated in place rather than accumulating:

```md
<!-- qoq:discovery -->

- test (full suite): `npm test`
- test (one file): `npm run test:execute -- {file}`
- build: `npm run build`
- runner: vitest, globals on, React

<!-- /qoq:discovery -->
```

Two properties the record alone can't give: it survives a reinstall, a deleted
`node_modules`, or a fresh clone on another machine — the second discovery is
silent because the answers are committed. And the **caller** writes it, not the
agent: persisting the answer is part of asking, and asking belongs to the caller.

Keep the block's scope tight. It holds answers to discovery's questions, not
project documentation at large — if something isn't one of the recorded fields,
it doesn't go in.
