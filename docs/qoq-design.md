# QoQ — why it's built this way

**Maintainer reference, not the spec.** Nothing here is loaded by an agent at
run time, and nothing here is a rule. `skills/qoq/SKILL.md` and the command
references are the spec; this file holds the reasoning behind their design —
the arguments a person needs when deciding whether to change something, and
which an agent executing a command would pay for on every run without ever
acting on.

The split is the same one `docs/qoq-workflows.md` already makes for diagrams: a
picture an agent can't act on doesn't belong in its context, and neither does an
argument about a decision that has already been made.

**When a rule changes, the rule moves in the skill and its argument moves
here.** A design note describing a rule that no longer exists is worse than no
note — it reads as current and nothing contradicts it.

| Topic                                         | Spec                      |
| --------------------------------------------- | ------------------------- |
| [The discovery record](#the-discovery-record) | `references/discovery.md` |
| [`fix`](#fix)                                 | `references/fix.md`       |
| [`refactor`](#refactor)                       | `references/refactor.md`  |
| [`bump`](#bump)                               | `references/bump.md`      |
| [`execute`](#execute)                         | `references/execute.md`   |
| [`test`](#test)                               | `references/test.md`      |

## The discovery record

**Why it's cached at all.** One JSON file, six consumers, and an agent that runs
only when the file can't be trusted. No command re-derives any of it, which is
the point: two commands that each work out "what's the test command" will
eventually disagree, and the one that's wrong won't announce it.

**Why it lives in `node_modules`.** `node_modules/@ladamczyk/qoq-cli/bin/` is
already qoq's own per-project scratch (`eslint.config.mjs`, `knip.config.mjs`,
`.eslintcache`), so the record lives and dies with the installed CLI. That's the
right lifetime: its answers are only valid for the dependency tree currently
installed, and `npm install` wiping it is the invalidation working rather than
failing.

**Why JSON rather than prose lines.** Five agents read it and none of them
should be parsing anything by eye.

**Why the hash is a projection, not the files.** Hashing `package.json` and the
lockfile whole made the gate fire on inputs the record has no stake in: `version`
moves on every release commit, and a lockfile moves whenever any transitive
dependency does. Each of those dispatched a Haiku run to re-confirm answers
nothing had touched — the exact cost the gate exists to avoid. So the digest
takes the `scripts` block and the four dependency names the other fields are read
off, and skips their versions too: `runner` is `vitest` at any version, and a qoq
CLI upgrade deletes the record outright, since the record lives inside that
package. Over-matching a neighbour (`@vitest/coverage-v8`) is the safe direction —
one wasted re-derive, against a field silently describing a project that's gone.

**Why the skill's agent files are _not_ in the hash.** They were, for exactly one
reason: discovery installed them, and a skill upgrade that ships a changed agent
touches nothing in the project, so nothing else would notice. But that answered a
question about the skill with a gate built to answer a question about the
project, and the two go stale independently. Every upgrade then read as a moved
dependency and bought a Haiku run to re-confirm project answers nobody had
touched — and every user gets upgrades. Splitting them costs one extra script
exec per run: `sync-agents.mjs` moves to the head of entry, compares six small
files, and prints its own verdict. Cheaper than what it replaced, and it lands
sooner, since a shipped agent change now reaches the project on the next command
rather than whenever the project next happens to move.

**Why a refresh is announced like a first install.** The user is being told one
thing — the agent bodies on disk are not the ones Claude Code has registered —
and that is equally true whether the file is new or newly changed. Distinguishing
them would suggest a difference in what to do about it, and there isn't one: the
same pickup window, the same `general-purpose` fallback inside it, the same
question ahead of `fix`, `test` and `execute`. So `sync-agents.mjs` emits one
line for both cases, and the skill has one rule instead of two.

**Why the record holds no lens list at all.** It held one: `skills`, mapping
`ponytail-review` to the string that invokes it. The field was unhashable in
principle — a lens lives in the caller's available-skills list and in no file the
digest could cover — so installing one, or moving it between project and plugin
scope, left the hash matching and the field wrong. Silently: `refactor` would
skip assessment 3, or dispatch a name resolving to nothing, and the documented
fix was to hand-edit JSON inside `node_modules`.

Nothing needed it cached. `refactor` runs on the main thread, so the list is
already in the context of the one thread that consults the lens — free to read
and never out of date. The cache was buying a staleness class in exchange for a
lookup that cost nothing. The tell was in the prose: one rule — _the recorded
value is the invocation, and bare and prefixed forms do not resolve
interchangeably_ — had been restated in five files, which is what a design that
wants changing looks like from the documentation side.

What it cost to delete: the lens check is now visible only inside `refactor`
rather than on a record anyone can read. Judged the cheaper side, because a
record that describes the lens wrongly is worse than one that doesn't describe
it.

**Why the mechanical half of derivation moved into the check script.** The agent
derived ten fields from scratch on every stale record, and most of them were
reading rather than judgement: which scripts exist, which test stack is
installed, whether the CLI resolves to a workspace link. `discovery-check.mjs`
was already parsing `package.json` to compute the hash, so the same read was
being implemented twice — once to hash, once to derive — which is precisely how
two answers to one question appear.

Now the check emits `proposed` and `unresolved` on the stale path, and the agent
checks a filled-in record instead of building one. The derivation runs only
after the hash has already failed, so the common path — a current record, which
is nearly every run — pays none of it. `test:one` stays unresolved every time:
both runners take a path positionally, so a default is easy to write and easy to
be wrong about, and a project with its own single-file script wants that one.

The same script now exits 3 when the qoq CLI is absent. That was an agent
dispatch whose entire finding was a missing directory.

**Why `entry.mjs` exists.** Three scripts already owned the three head-of-run
answers, and `SKILL.md` carried the sequencing: two exit-code tables, a consent
procedure, and the rule about which commands ask after a fresh agent install.
That file is loaded on every run of every command, so all of it was paid whether
the run branched on it or not — and `compress`, which reads none of the record,
paid the most for the least.

Worse, two of those rules had been stated in more than one prose file and had
already drifted: `SKILL.md` said the agent-install question fires ahead of `fix`,
`test` and `execute`, and since `refactor` opens with a `fix`, a thread reading
`SKILL.md` and `refactor.md` would ask — while `discovery.md`, which
`refactor.md` never links, recorded the exception saying it shouldn't. A rule
that lives in two files is a rule that will eventually disagree with itself, and
this one already had. Both rules are now branches in `entry.mjs`, with a spec
each.

It composes and decides nothing the three children decide; each keeps its own
contract and its own spec.

**Why the stats disclosure is printed by the script.** It was prose in
`SKILL.md`, describing the request body. Two problems: every run paid for text
that matters on the one run in a user's life where somebody is actually asked,
and a description of a payload can come to promise less than the payload sends.
`stats.mjs` now builds the disclosure from the same object it posts, and quotes
it literally. A spec asserts the two stay the same object.

**Why `sync-agents.mjs` tracks what it wrote.** It copies into the user's own
repo, usually into a tracked directory, and it could not tell its own last copy
from a file the user had edited — comparing against the current source doesn't
answer it, because a skill upgrade makes an untouched copy differ too. So each
install records a digest in `.qoq-agents.json`, and a body that isn't the one it
wrote is the user's and is kept. The one exception is a directory with no
manifest at all: that's every existing project on the first run after the upgrade
that shipped this, and protecting those would freeze them all on the agent bodies
they already had.

**Why derivation lives in the agent and not in the reference.** Two copies of
"how the test command is derived" is the same duplication the record itself
exists to prevent.

## `fix`

**Why it loops.** Fixes cascade: Prettier reformats a file and ESLint now has an
opinion about it, a Knip-driven deletion makes another export unused. One pass
hands back a "fixed" tree that fails the next check.

**Why the loop head is a script and not a judgement call.** A stale digest read
as current would make the command declare PASS over code nothing checked.
`scripts/reports-current.mjs` is an mtime comparison — far cheaper than the
tools, and it's what makes the loop head safe to call five times in a row
without five full tool runs.

**Why `fix` doesn't delegate the fixing.** A lint fix is a mechanical
single-file edit that has to be attributed to the tool that reported it.
Dispatching an agent per finding costs more than the fix and blurs that
attribution.

## `refactor`

**Why assessment 4 is this skill's own agent rather than an external lens.** The
general-purpose design-pattern reviewers teach the Java-shaped GoF forms, and a
TypeScript codebase reaching for `AbstractFactory` when a discriminated union
does the job is a worse outcome than no assessment at all. The catalogue in
`assets/patterns/` answers every pattern with what the language already gives
you first.

**Why the pattern catalogue is split by stack rather than merged.** The base
table's smells are about how code is shaped and hold in any file; React's exist
only because there is a render loop. Merged, every scan of a server directory
would read nine rows about prop drilling to reject them, and the framework rows
would keep growing as stacks are added. Split, the designer reads the base plus
at most one more, chosen from the files it was actually given.

**Why the stack is detected from the scope's files rather than `package.json`.**
A React project has server modules, jobs and scripts, and `refactor` is usually
pointed at one directory. A dependency list would put every one of those scans
in the React table — right about the project, wrong about the scope, and wrong
in the direction that produces findings nobody can act on.

**Why nine React write-ups and not twenty-one.** The commonly listed catalogue
mixes patterns with principles: DRY, KISS, SOLID and Separation of Concerns
propose no specific edit, and assessments 1 and 3 already argue their side.
HOCs and render props are the pre-hooks answers to problems custom hooks now
solve, and Atomic Design moves files without changing behaviour. They are named
in the React index with what to reach for instead, so nothing is silently
unmappable, but a write-up for each would be a catalogue that argues for
patterns nobody should apply.

**Why the scope default is `qoq.config.js`'s `srcPath`.** The project already
declared what its source is and every other qoq tool respects it. Re-deriving it
would be a second answer to a settled question.

**Why the assessments are ordered cheapest-first.** The judgement-heavy passes
at the end then look at a smaller, already-deduplicated tree.

## `bump`

**Why re-cutting a failed patch never needs re-approval.** It changes how the
approved bumps are sliced, not which ones were approved. The cost is many more
validate cycles than one grouped patch, which is the trade: the alternative is
skipping fourteen good bumps because a fifteenth was bad.

## `execute`

**Why there's no per-ticket standards pass and no complexity-driven routing
table.** Complexity rates the model and nothing else, so a `trivial` ticket and
a `judgment-heavy` one run identical steps at different tiers. The third TDD
beat belongs to the milestone instead — per ticket the scope is too small to see
anything.

**Why the usage gate is opt-in and per ticket.** A ceiling nobody asked for is
a stop nobody expected, and the check costs an authenticated round trip per
ticket, so a bare `qoq execute` fetches nothing at all — `--session-limit` /
`--weekly-limit` are what arms it. It runs before every ticket rather than once
at the start because the number it reports is about the run in progress, and a
reading taken before the first dispatch describes a plan that hadn't spent
anything yet. A yes at the ceiling disarms it for the rest of the run: usage
only climbs, so the alternative is the identical question before every remaining
ticket, which trains the user to answer without reading it.

**Why declining is a pause and not `blocked`.** `blocked` means the ticket
couldn't be delivered at any tier, and it files a `failure` the estimator uses
to recommend splitting the ticket. A ticket that was never dispatched has
nothing to grade — filing it would teach the next plan to decompose work that
was fine.

**Why the commit happens after the gate rather than inside the agent.** It falls
out of the gate running one thread up, and it's the better place regardless:
nothing reaches history until it has passed, and "one ticket, one commit" stops
depending on an agent's discipline.

## `test`

**Why N slices means N full-suite runs.** Each slice ends with a run whose whole
purpose is attribution. It's the same trade `bump` makes one patch at a time,
for the same reason: a check that can't say which change broke it isn't a check.
