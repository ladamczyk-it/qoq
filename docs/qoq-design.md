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

**Why the skill's agent files are in the hash.** Discovery is what installs them
into the project (its step 5), and a skill upgrade that ships a changed agent
touches nothing in the project. Hashing them makes an upgraded skill exactly as
stale as a moved dependency, which costs one Haiku run and is the only thing
that would notice.

**Why `skills` holds one key and not two.** `refactor`'s fourth assessment is
`qoq-designer`, this skill's own agent, which ships with the skill and so is
never absent. Only the ponytail lens is somebody else's.

**Why the lens list isn't re-checked per command.** It can't be hashed — it
lives in the caller's context, not in any file — so keeping it current would
mean dispatching the agent on every run, which is the entire cost the record
exists to remove. Deleting the record is the escape hatch, and it costs one
discovery run.

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

**Why the commit happens after the gate rather than inside the agent.** It falls
out of the gate running one thread up, and it's the better place regardless:
nothing reaches history until it has passed, and "one ticket, one commit" stops
depending on an agent's discipline.

## `test`

**Why N slices means N full-suite runs.** Each slice ends with a run whose whole
purpose is attribution. It's the same trade `bump` makes one patch at a time,
for the same reason: a check that can't say which change broke it isn't a check.
