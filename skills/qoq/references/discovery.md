# Discovery — the record every command starts from

One dispatched agent, one cached file, six consumers. No command re-derives any
of this, which is the point: two commands that each work out "what's the test
command" will eventually disagree, and the one that's wrong won't announce it.

## Who reads what

| Command         | Lines it needs                                                  |
| --------------- | --------------------------------------------------------------- |
| `fix`           | `run`, `check`, `test:one`, `build`                             |
| `refactor`      | the same, plus `skills`                                         |
| `bump`          | `run`, `test`, `build`                                          |
| `plan`          | `test`, `build` — copied into the plan's Commands header        |
| `execute`       | `test`, `build` — for the milestone gate                        |
| `test`          | `test:one`, `test`, `runner`, `globals`, `react`, `conventions` |
| `qoq-developer` | all of it                                                       |

Nobody passes anything but the project root and the `skills:` line, and nobody
gets a different answer than anybody else.

## The interface

The caller dispatches `qoq-discovery` with the project root **and the resolved
`skills:` line**. That's the whole interface. The agent returns the record's
contents plus one word:

| Returned             | Caller does                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `fresh`              | carry on                                                            |
| `verified`           | carry on                                                            |
| `repaired <fields>`  | carry on, notify the user at the end of the run                     |
| `blocked <question>` | ask the user, write the answer into the project's docs, re-dispatch |

The caller branches on that word and nothing else. It does not look for the
record itself, does not verify it, and does not decide full-run-vs-repair —
otherwise every caller carries the verify list and they drift apart, which is the
exact duplication the agent exists to remove.

One instance per **top-level** run, never two: they would race on the same file.
A command invoked from inside another — `fix` under `refactor`, `refactor` under
`bump` — inherits the record the outer run already has. Re-dispatching per nested
call would fire discovery three or four times for one `/qoq refactor` to confirm
a file nothing has touched since.

## The record

```
node_modules/@ladamczyk/qoq-cli/bin/qoq-skill-discovery.md
```

That directory is already qoq's own per-project scratch (`eslint.config.mjs`,
`knip.config.mjs`, `.eslintcache`), so the record lives and dies with the
installed CLI. `npm install` wipes it and discovery re-runs — the right lifetime,
since its answers are only valid for the dependency tree currently installed.

**Written for an agent, not a human.** One fact per line, no headings, no prose,
nothing that isn't read back, every boolean `yes`/`no`. The ten lines are in
`SKILL.md`; only two of them need saying twice.

There is no `lint:` line — linting is what `run:` does.

`test:one` carries a `{file}` placeholder. It exists because most checks in this
skill are narrow — one spec just written, one file just fixed — and re-running a
whole suite to learn about one file is the difference between a loop that's
usable and one that isn't. `bump` deliberately never uses it: after a dependency
moves, "which tests could this have broken" isn't answerable.

## Deriving it is the agent's job, not yours

Verification, the four derivation steps, and self-repair all live in
`agents/qoq-discovery.md`, and this file deliberately doesn't restate them — two
copies of "how the test command is derived" is the same duplication the record
itself exists to prevent. What a caller needs to know about the outcome:

**A missing CLI stops the whole run.** Every command's spine is `fix`, and `fix`
is the qoq CLI. Without it they'd degrade into advice while still calling
themselves a gate, which is worse than not running.

**A repaired record is announced, at the end of the run.** The agent fixes stale
lines without asking — no permission is needed to re-derive a fact it already
knows how to derive — but a silent rewrite of the file every command trusts is
exactly what should never happen unannounced:

```
Discovery record updated:
  test:one   npm run test -- {file}  →  npm run test:execute -- {file}
  skills     design-pattern-review=no → yes
```

A record that verified clean produces no notice at all.

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
