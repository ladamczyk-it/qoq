# `/qoq-fullstack plan` — requirements in, a BRD and one plan per repo out

Read [SKILL.md](../SKILL.md)'s entry, state, session and setup rules first. This
file assumes them.

**Open with one line:** _Planning is the judgement-heavy part: the business
grilling and the BRD. Run it on a bigger model, and we recommend Opus
(`/model opus`)._ Say it once and carry on. The model is the user's choice.

## 1. Business grilling — here, business only

Run `grilling` over the request. Look for it in your own available-skills list.
If it isn't there, stop: it normally arrives with `qoq` as a plugin dependency
(`/plugin install mattpocock-skills`). **Ask about the business, never the technology.** Ask about
who the actors are, what they can do, what they observe, and where a milestone
ends. Which repos a requirement lands in is not asked here either: each repo
works that out from its own code. Endpoints, schemas, libraries, frameworks,
storage and file layout belong to the repos.

When a technology question comes up, from the user or from you, don't ask it.
Write it, verbatim, into the BRD's **Parked technology questions** list, and say
in one line that it was parked. Every repo's planning gets the list, and the
repo it lands in asks it in its own grilling, against code this thread has
never read.

`feature.json` missing → write it with the user: every repo, its role, any
`after`, every integration check, and the `permissionMode` repo sessions run in. Never guess an integration check. A
master milestone with no check is one the user explicitly said needs none.

## 2. Write and approve the BRD

Write `feature/<slug>/brd.md` with `Feature status: draft`:

- every requirement as a **Given/When/Then scenario** tagged with its milestone;
- the master milestones with their **Depends on** and **Integration**;
- the parked questions.

Run the same check as plan.md's definition-of-ready gate, at the business level.
Every scenario has to be observable without reading code, and every milestone
has to be deliverable on its own. On approval, set `Feature status: approved`.

## 3. A plan per repo

**Every repo in `feature.json` plans**, in `after` order. Repos with no `after`
start together, and a repo starts once every repo in its `after` is settled:
its plan is approved, or it answered **no changes needed**. Start each one with:

> `/qoq plan` with: the BRD's path; every scenario and master milestone; the
> parked technology questions. First decide from your own code whether any of
> it lands in this repo. If none does, write no plan and report
> `no changes needed — <one line why>`. Otherwise your plan directory is
> `plans/<YYYY-MM-DD>-<slug>/`. Every milestone row names the master
> milestones it serves in a **Serves** column, and the header carries the
> **Feature** line (`qoq`'s plan template, "A repo's share of a feature").
> Consume a contract only from `<root>/contracts/`. When your plan is approved,
> write a `contracts/<name>.md` for every contract another repo consumes.

Approval of each repo plan reaches the user through the relay, like any other
question, and so does a **no changes needed** with its reason. A repo can't
approve its own plan, nor its own "nothing to do".

Once the user approves, check the files: the plan directory's `index.md`
exists and says `Plan status: approved`, or for `none`, no plan directory was
written. Read the index itself. The status script can't see a repo's plan until
its row is in the table, so it can't do this check. Then write the repo's row into the
BRD's **Repo plans** table, as its plan directory or `none`, and start every repo
whose `after` is now settled. A `none` repo's existing contracts still hold for
the repos after it: they plan against its code as it stands.

## 4. Schedule: automatic, no questions

The repos run in parallel, so the order inside each repo decides how long the
others wait. Once every repo is settled, run
`node ${CLAUDE_SKILL_DIR}/scripts/schedule.mjs --root <root> --feature <slug>`. It simulates the run,
with each milestone's ticket count as its duration, and returns each repo's
delivery `order`. Milestones that don't depend on each other are reordered so
that the piece another repo needs goes first. A hard dependency never moves.

For each repo with `reorder: true`, send it: _reorder the rows of your
Milestones table to `<order>`. Keep every number, Depends on and file as they
are, commit, and report back._ This needs no user question, because no
dependency, scope or milestone changes, only the sequence. Check the result
with `schedule.mjs` again: every `reorder` is now false. In the hand-off, list
each repo's new order in one line, along with any `idle` the simulation still
shows. A remaining wait is one only a split milestone could remove, and that is
a `qoq replan` the user can ask for.

This step is the judgement-heavy part of planning, which is why `plan` is
recommended on Opus while `execute` only follows the order.

## 5. Coverage, then hand off

Once every repo is settled, run the status script. Every master milestone needs
at least one repo milestone serving it. A milestone nothing serves is a gap.
Ask the user which repo takes it, and send it there: a `qoq replan`, or a
`qoq plan` for a repo that answered `none`. Then offer
`/qoq-fullstack execute <slug>`.
