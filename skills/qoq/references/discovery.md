# Discovery — the record every command starts from

One cached JSON file, six consumers, and an agent that runs only when the file
can't be trusted. **No command re-derives any of this.**

## Who reads what

| Command         | Fields it needs                                                 |
| --------------- | --------------------------------------------------------------- |
| `fix`           | `run`, `check`, `test:one`, `build`                             |
| `refactor`      | the same, plus `skills`                                         |
| `bump`          | `run`, `test`, `build`                                          |
| `plan`          | `test`, `build` — copied into the plan's Commands header        |
| `execute`       | `test`, `build` — for the milestone gate                        |
| `test`          | `test:one`, `test`, `runner`, `globals`, `react`, `conventions` |
| `qoq-developer` | all of it                                                       |

Nobody passes anything but the project root and the `skills` field, and nobody
gets a different answer than anybody else.

## The interface

**Step one is a script, not an agent:**

```bash
node <skill>/scripts/discovery-check.mjs --project <root>   # 0 use it, 1 re-derive
```

The record carries a hash of the `package.json` and lockfile it was derived from.
Matching hash, exit 0, the record on stdout — the caller uses it and dispatches nothing. That's
the common case and the reason the file exists: an agent and a dozen file reads
to re-confirm answers nothing has touched is the cost this avoids.

Exit 1 — no record, or one derived from a `package.json`/lockfile that has since
changed — and only then does the caller dispatch `qoq-discovery`, with the project root, the hash
the script printed, **and the resolved `skills` field**. That's the whole
interface. The agent returns the record's contents plus one word:

| Returned             | Caller does                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `fresh`              | carry on                                                            |
| `verified`           | carry on                                                            |
| `repaired <fields>`  | carry on, notify the user at the end of the run                     |
| `blocked <question>` | ask the user, write the answer into the project's docs, re-dispatch |

The agent's last line is separate from that word: it reports whether the skill's
agent files were installed into the project's `.claude/agents/` (the agent's step
5 — agents that live inside a skill are registered by nothing). `agents current`
needs nothing from you. Anything else, and the command about to run is `fix`,
`test`, or `execute`, **ask the user before carrying on**, with these two
options:

- **continue** — the run proceeds now, and every dispatch until Claude Code picks
  the directory up is the `general-purpose` fallback SKILL.md describes
- **exit and re-run** — they end the session and start the command again, with
  every agent registered from the first dispatch

Claude Code registers the directory on its own — new files and edited ones alike,
within about a minute — so what they're choosing about is that window, not a
permanent state. Those three commands are the ones that dispatch a pinned agent
inside it: `fix` opens every loop with `qoq-checker`, `test` and `execute` are
dispatch-per-slice and dispatch-per-ticket from the start. And for the agents
whose contract is a _restriction_, the fallback is the restriction gone — an
unregistered `qoq-tester` has exactly the ability to edit production source its
contract forbids. Only the user knows whether the run they're starting is worth a
restart, so ask rather than assume.

`plan` and `bump` don't ask: their first dispatch is minutes of reading away, by
which time the agents are registered. Mention the install in the end-of-run
notice instead. `refactor` is the deliberate exception — it opens with a `fix`,
so its first `qoq-checker` does land in the window, and it still doesn't ask,
because a question in front of a command whose next move is another command's
question is the noise this narrowing exists to remove.

If they choose to exit, stop there — don't run half the command first.

The caller branches on that word and nothing else. It does not verify the record
line by line and does not decide full-run-vs-repair — otherwise every caller
carries the verify list and they drift apart, which is the exact duplication the
agent exists to remove. The one thing it does decide is whether to dispatch at
all, and it decides that by exit code rather than by judgement.

One instance per **top-level** run, never two: they would race on the same file.
A command invoked from inside another — `fix` under `refactor`, `refactor` under
`bump` — inherits the record the outer run already has. Re-dispatching per nested
call would fire discovery three or four times for one `/qoq refactor` to confirm
a file nothing has touched since.

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
  "conventions": "./testing-gate.md",
  "skills": {
    "ponytail-review": "ponytail:ponytail-review"
  }
}
```

A full check is `<run> <check>`, the two fields concatenated. Answers the user
gave by hand live in the project's own docs instead, and outlive the record.
Three fields need saying twice.

`hash` covers `package.json`, the first lockfile present (`package-lock.json`,
`npm-shrinkwrap.json`, `pnpm-lock.yaml`, `yarn.lock`), and **the skill's own
agent files**. The first two because the record's answers come from both: the lockfile is the tree the
CLI invocation and check flags were derived for, and `package.json` holds the
scripts every command field quotes verbatim — renaming one of those changes no
lockfile, and the record would go on naming a script that's gone. It is the whole
freshness check, and `scripts/discovery-check.mjs` owns computing it: the agent
stamps the value it was handed rather than deriving its own, because two
implementations that disagree mean a record that never matches and an agent
dispatched on every run.

The agent files are in there because discovery is what installs them into the
project (step 5), so an upgraded skill has to be as stale as a moved dependency.

`skills` holds one key, `ponytail-review`, mapped to **the string that invokes
it**, or `null` when it isn't installed. The value is bare when the project ships
the lens and `plugin:skill` when it comes from the global or plugin scope, so one
field answers both "is it installed" and "what do I call it" — and the `null`
case can't accidentally carry a name that resolves to nothing.

There is no `lint` field — linting is what `run` does.

`test:one` carries a `{file}` placeholder. It exists because most checks in this
skill are narrow — one spec just written, one file just fixed — and re-running a
whole suite to learn about one file is the difference between a loop that's
usable and one that isn't. `bump` deliberately never uses it: after a dependency
moves, "which tests could this have broken" isn't answerable.

## Deriving it is the agent's job, not yours

Verification, the four derivation steps, and self-repair all live in
`agents/qoq-discovery.md`. What a caller needs to know about the outcome:

**A missing CLI stops the whole run.** Every command's spine is `fix`, and `fix`
is the qoq CLI. Without it they'd degrade into advice while still calling
themselves a gate, which is worse than not running.

**A repaired record is announced, at the end of the run.** The agent fixes stale
fields without asking — no permission is needed to re-derive a fact it already
knows how to derive — but a silent rewrite of the file every command trusts is
exactly what should never happen unannounced:

```
Discovery record updated:
  test:one   npm run test -- {file}  →  npm run test:execute -- {file}
  skills     ponytail-review null → ponytail:ponytail-review
```

A record that verified clean produces no notice at all, and a record the script
accepted was never opened by an agent in the first place.

## What the hash doesn't cover — tell the user

The hash covers the three inputs listed above and nothing more, so it catches
what those files say: the dependency tree moved, a script was renamed, the skill
shipped a changed agent. Everything the record holds that _isn't_ in one of them
can go stale silently, and the review lens is the case that actually bites:

- installing `ponytail-review` after a record was written leaves it saying
  `null`, and `refactor` keeps skipping assessment 3
- moving it between project and plugin scope changes the name that invokes it,
  and the record keeps the old key — the dispatch then names a skill that isn't
  there
- pointing the project at a different skills directory does the same

None of those touch a hashed file, so nothing notices. **Say this to the user when
it's relevant** — when they mention installing a lens, when `refactor` reports a
lens missing, or when a run skips an assessment they expected:

> The discovery record caches which review lenses are installed and what they're
> called. Installing or moving one doesn't invalidate it, so edit the `skills`
> field in `node_modules/@ladamczyk/qoq-cli/bin/qoq-skill-discovery.json`, or
> delete the file to have the next run re-derive everything.

Deleting is the safe move and costs one discovery run.

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
