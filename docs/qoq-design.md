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
| [`plan`](#plan)                               | `references/plan.md`      |
| [`replan`](#replan)                           | `references/replan.md`    |
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

**Why JSON rather than prose lines.** Every consumer reads it cold, and none of
them should be parsing anything by eye.

**Why the hash is a projection, not the files.** Hashing `package.json` and the
lockfile whole made the gate fire on inputs the record has no stake in: `version`
moves on every release commit, and a lockfile moves whenever any transitive
dependency does. Each of those dispatched a Haiku run to re-confirm answers
nothing had touched — the exact cost the gate exists to avoid. So the digest
takes the `scripts` block and the dependency names the other fields are read off,
and skips their versions too: `runner` is `vitest` at any version. Over-matching a neighbour (`@vitest/coverage-v8`) is the safe direction —
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
installed. `discovery-check.mjs`
was already parsing `package.json` to compute the hash, so the same read was
being implemented twice — once to hash, once to derive — which is precisely how
two answers to one question appear.

Now the check emits `proposed` and `unresolved` on the stale path, and the agent
checks a filled-in record instead of building one. The derivation runs only
after the hash has already failed, so the common path — a current record, which
is nearly every run — pays none of it. `test:one` stays unresolved every time:
both runners take a path positionally, so a default is easy to write and easy to
be wrong about, and a project with its own single-file script wants that one.

**Why the CLI isn't discovered at all.** The record used to carry `run` and
`check`, and the agent read the CLI's own `AGENTS.md` — thousands of tokens — to
learn two flags. Both were discovery of a constant: `npx qoq --check --json` is
the same line in every project this skill runs in, and the one variation
(a workspace symlink, in the CLI's own monorepo) is a `test -L` that any thread
can run in the moment it matters. So the fields are gone, the CLI is no longer a
watched dependency, and the script no longer exits 3 on a missing install — a
project without the CLI is not a case this skill spends a field, a hash input and
an agent dispatch to handle. What replaces all of it is `references/cli.yaml`,
which the threads that actually run the binary open when they need it.

The cost of the old arrangement wasn't only tokens. Two fields concatenated as
`<run> <check>` meant every caller had to be told the concatenation, and a record
that failed to carry `check` was a set of flags for an agent to invent.

**Why the CLI's real shape is written down where it can't be guessed.** Two of
its properties fail silently: positional arguments are tool _names_, so
`npx qoq --check src/auth` quietly asks for a tool that doesn't exist; and
`staged`, the only path-scoped command, takes no `--json` and therefore writes no
reports. An agent reasoning from "the scope is positional everywhere" would get
both wrong and report a clean project. Neither is derivable from the skill's own
conventions, so both are stated rather than left to inference.

**Why that statement is a YAML file and not prose.** `references/cli.yaml` is the
only file here that isn't written for a reader — it's a lookup table: keys for the
four invocations, the report path, the two helper scripts with their exit codes,
a `facts` list of the five things that fail quietly, and `may_run`, which says
per command and per agent what that thread is allowed to invoke. Prose was the
wrong shape for it twice over. It was duplicated into four files the moment more
than one thread needed it, and a flag stated in four places is a flag that drifts
in three; and the whys around it were re-read on every dispatch by agents that
needed a command line, not an argument. YAML costs about a third of the tokens
the same content cost as a Markdown section, and it can be diffed for drift by
eye. What stays in prose is only what stops a wrong action in context — the
checker's "never reuse reports the script called stale", the writers' "the gate
is your caller's" — and each of those now sits in exactly one agent file.

**Why `SKILL.md` doesn't restate any of it.** It named the file and then
described its contents, and the command references pointed back up at that
description — so a fact about the binary had three homes and the dependency ran
in both directions. The router now does one thing in both places: it says which
file answers which question. Nothing under `references/` or `agents/` refers to
`SKILL.md` at all any more, which is what makes each of those files readable on
its own — an agent gets one of them pasted into a cold context and can act on it
without a file it will never be given.

**Why the writing agents got the CLI, and only `staged`.** `qoq-developer` and
`qoq-tester` were forbidden the binary outright, on the grounds that a second
answer to "is this clean" would compete with the gate. But the cheapest lint
finding still cost a full dispatch-and-gate round trip. `npx qoq staged` over the
files an agent just wrote is scoped, takes seconds, and produces no digest — so
it cannot compete with the gate, because the gate _is_ the digest. `--fix` and
`--check` stay out for a reason that outlives the policy: neither takes a path,
so either one would leave the caller unable to tell the ticket's diff from the
reformat.

**Why there is no discovery agent any more.** There was one, pinned to Haiku,
and once the mechanical half moved into the check script its remaining job was:
read the committed `qoq:discovery` block, settle `test:one`, verify a few lines,
write eight lines of JSON. Costed out, the dispatch was about $0.19 against $0.15
inline and roughly twice the wall clock, buying some 1.5k tokens of context
cleanliness — marginal either way. Two structural facts settled it.

The Haiku pin never held on the run that mattered. The record is always stale on
the first run in a project, which is the same run where `sync-agents` has just
installed the agent files — so the dispatch landed inside Claude Code's
registration window and took the `general-purpose` fallback: session tier, every
tool, the agent body pasted into the prompt. The one dispatch with real judgement
in it ran at the caller's model anyway, and every later one was transcription.

And `blocked` cost a round trip nothing else needed. Ambiguity meant the agent
wrote nothing and returned a question, the main thread asked the user, wrote the
answer into `CLAUDE.md`, and dispatched again — two dispatches and a user turn
for a question the main thread could have asked directly, given that asking and
persisting the answer were already its job.

What it cost to remove: on a first run in an awkward project — no committed
block, non-standard scripts — the derivation reads three to five files into the
main context and they stay there for the rest of the run. Once per project, and
the answers are committed immediately after, so it doesn't repeat.

**Why `sync-agents.mjs` deletes as well as installs.** Dropping an agent from the
skill left every project that had ever run it holding a registered, dispatchable
copy whose contract existed nowhere any more — worse than a stale copy, which at
least still matches something. Removal takes the same proof as overwriting: the
file is in the manifest, so this script wrote it, and its digest still matches
what was written. An edited copy is reported and kept, never deleted. The one
addition is dangling symlinks: a checkout that symlinks its agents never appears
in the manifest, and a link with nothing behind it holds no edit to lose.

**Why `entry.mjs` exists. Three scripts already owned the three head-of-run
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

**Why a scoped `fix` still runs the whole check.** `--check` takes no paths, so
scope is a property of the verdict rather than the invocation: the command runs
the full check and reports on the files it was asked about. The alternative —
`staged`, which does take paths — writes no reports, and a gate with no digest
has nothing to hand back on a FAIL.

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

## `plan`

**Why an external interview skill instead of `plan` asking its own questions.**
`plan` could ask. It would ask badly: one question at a time, in the order the
decomposition happened to need them, from a context already full of the plan it
is trying to write. `grilling` works a design tree in rounds — the whole frontier
of questions whose prerequisites are settled — which is a different algorithm,
not a politer version of the same one. Writing that into `plan.md` would be
re-implementing a skill the user can install, and paying for it in every local
run's context whether the requirements were vague or not.

**Why the skill invokes `grilling` and not `grill-me`, which is what a user
types.** `grill-me` sets `disable-model-invocation: true`, so it never appears in
the available-skills list a model resolves against and cannot be called from
another skill; its entire body is one line handing off to `grilling`. A check
written against the name the user knows would report it missing on every machine,
including the ones where it's installed — a silent downgrade that looks like a
correct negative. This is worth restating if the mattpocock plugin ever
restructures: the rule is _look for the skill Claude can invoke_, not the one the
human types.

**Why the grill runs before `Explore` rather than after decomposition.**
`Explore`, the decomposition and the estimator all reason from the requirements,
so a gap still open when they start gets reasoned from three times, three
different ways. Running the interview afterwards would mean re-deciding work
already sized. The one-ticket stop stays ahead of it because it's a single cheap
read and it's the one answer that makes the whole interview pointless.

**Why the subsystem stop stays downstream of the grill.** "These are two
unrelated things" is usually a conclusion the questions reach, not something
visible in the requirements as handed over. Moving it up would ask it of the
version of the requirements least able to answer it.

**Why the architect is an agent rather than a pass on the main thread.** The
argument for main-thread was that the requirements, the grill's answers and
`Explore`'s output are already sitting in that context. It's wrong twice. That
context is _cluttered_ rather than clean — a grill transcript full of discarded
branches, plus the skill's own references — and high-volume reading in the
orchestrating context is the exact thing dispatching exists to avoid. The design
also needs the architect to be able to say "I don't know", which is only
meaningful from a reader that hasn't already absorbed every assumption the
planning conversation made.

**Why `Explore` wasn't just widened instead.** It locates; it doesn't audit — by
its own description it reads excerpts rather than whole files. Widening it to
read deeply would make every plan pay a deep read of everything it found, which
is the opposite of what makes a fan-out cheap. Both agents earn their dispatch
precisely because they're different jobs: `Explore`'s breadth is what keeps the
architect's depth targeted.

**Why the architect inherits the session's model.** Every other pinned agent does
one bounded job whose blast radius is its own report. A design error doesn't stay
where it was made: it becomes a contract, and every ticket in the milestone is
written against it. This is the one place in the pipeline where a cheaper tier is
a false economy paid for by everything downstream.

**Why it reads pattern indexes but not the write-ups.** `qoq-designer` already
names the hazard — pattern documentation is persuasive by construction, and an
agent that reads the Observer write-up before scanning starts seeing Observer
everywhere. That hazard is strictly worse at design time, because at refactor
time there is real code to falsify a pattern against and at design time there is
nothing at all. An architect scanning with the catalogue open produces a
Factory-Strategy-Observer cathedral for a CRUD endpoint.

The post-citation read is what keeps the catalogue from being unreachable rather
than merely un-loaded. Once a pattern is named against a `file:line` smell in
code that already exists, the candidate is fixed and further reading can only
falsify it, not widen it — so the write-up is safe to open at exactly that point,
and useful, because it's the thing that can say "this doesn't fit". That's the
move `qoq-designer`'s caller already makes; here it happens one step earlier,
under a citation the reading can't revise.

**Why the skip is one conjunction and not a judgement call.** A skip has to be
decidable from what the main thread already holds — the requirements and
`Explore`'s findings — or it's a guess about a pass being guessed away. Single
existing module, no invented shape, no new dependency: that's the plan whose
design output would have been three "none"s, and it's the same plan whose
`Contracts` will legitimately read `none`. Any doubt dispatches, because the cost
of a needless architect is one agent round and the cost of a missed one is
distributed across every ticket as scope nobody planned.

**Why scenarios sit on the milestone and aren't just duplicated criteria.** The
obvious objection is that acceptance criteria are already assertions, so writing
journeys too writes the same thing twice and the copy rots. It doesn't, because
neither altitude can express the other: a criterion is one ticket's assertion, a
scenario is a user journey spanning tickets. Nothing in the plan file held the
second, and a milestone's whole claim is that it's independently shippable —
which is a statement about journeys, not about assertions. They're written in
Phase 1 rather than Phase 2 because they're a requirements artifact in the user's
language and the direct output of what the grill settled; the architect then
_consumes_ them, which is the right direction. And they earn their place with no
e2e consumer at all: they give acceptance criteria a parent to be derived from,
which is the cheapest available guard against an invented criterion.

**Why prose and not Gherkin.** The intended consumer is a model, which needs no
formal grammar. Real Gherkin in a plan file invites someone to point Cucumber at
it, and then it wants step definitions and a runner nobody asked for. Bolded
keywords keep it greppable without inviting any of that.

**Why `--tool` is a flag on `plan` and not a command of its own.** A separate
`qoq export` would be a fourth surface with its own discovery, its own scope
grammar and its own approval. The export is one beat that only ever happens right
after an approval, so it lives where the approval is. If it ever grows a
re-export-the-changed-ones mode, that's the point to reconsider — the
**External** field already makes it re-runnable.

**Why the export is offered rather than folded into approval.** Approving a plan
and publishing it into a team's tracker are two different acts with two different
blast radii: one writes a file this repo owns, the other notifies real people and
leaves items somebody has to delete by hand. Collapsing them would make "approve"
mean something different depending on a flag typed several minutes earlier.

**Why `local` is the default and the plan file is always written.** `qoq execute`
reads `./plans/*.md` and nothing else. Making a tracker authoritative would put
delivery behind a network call and a credential, for the benefit of a projection
nobody's build reads. `--source` doesn't change that — it produces a plan file
and then reads it, which is the same rule from the other side.

**Why three trackers are named rather than a generic adapter.** Jira, Linear and
Trello are the three the user asked for, and a fourth is a row in one table plus
its quirks. An adapter interface with three implementations would be the same
table with indirection over it, and the thing that actually varies — which MCP
server is connected and what its tools are called — can't be captured in the
skill at all, because it's discovered from the session's tool list at run time.

**Why the mapping is `references/export.md` and not part of `plan.md`.** The
default is `local`, so most runs would read three trackers' field tables to use
none of them. It's the same progressive-disclosure split the pattern catalogue
makes in `refactor`. Import lives in that same file rather than in `execute.md`
for the harder version of the reason: it reads the identical table backwards,
and two copies of a field mapping disagree the first time a tracker adds a
field.

## `replan`

**Why delivered work is frozen.** The hard case is a half-executed plan, and the
archive's own rule is that it's append-only history — nothing in it is ever
re-planned or re-gated. A `done` ticket that gets re-decomposed loses the link
between its criteria and the commit that satisfied them, and at that point the
history stops meaning anything: the commit is still there, but nothing says what
it was for. So the file splits in two. Frozen parts are read-only _input_ and get
a mechanical backfill only — a missing `Log` reconstructed from git, a missing
`Estimate` from the script. Live parts get the full reshape.

The split also dissolves a question that looked hard: whether `replan` is a
migration or a reshape. It's both, and which one applies is decided per section
by whether the work has shipped.

**Why the failure history is the grill's best input.** Blocked tickets,
escalations and `scope-expansion` attributions are direct evidence that the old
decomposition was wrong, they're already sitting in the plan file, and nothing in
the system reads them at plan time today. It's also why re-grilling is cheap:
`plan` already hands the interview everything settled so its frontier opens on
the gaps, and here "settled" is enormous — the whole old plan plus milestones
that demonstrably work. The grill is self-limiting, so no skip mode is needed.

**Why it overwrites in place and refuses on uncommitted changes.** The path has
to stay stable: `External` keys, the `.completed.md` archive and any resume all
reference the plan by name, so a `.v2` file would orphan all three. Git is the
history, which makes a second file redundant anyway. But overwriting uncommitted
work destroys the only copy, so the guard is a refusal rather than a warning —
it costs one `git status`.

**Why it's a command and not a flag on `plan`.** `plan.md` is already the longest
reference in the skill; folding this in would make every fresh plan pay for the
rare case. `qoq replan plans/<file>.md` also fits the existing positional-scope
grammar exactly, and its own reference stays short by _naming_ `plan`'s phases
rather than restating them.

**Why it reports tracker orphans instead of syncing them.** The skill's position
everywhere is that the export writes once and never syncs back. A live ticket
that's re-decomposed loses its `External`, and the issue it was is now dangling —
so `replan` lists them at approval and the user closes them by hand. Syncing is
the entire problem this skill deliberately refuses to own, and a re-decomposition
is the worst possible place to start owning it.

**Why calibration is untouched.** A recorded outcome means "this shape of work at
this tier went this way", which stays true regardless of how the plan is now
shaped. Stated explicitly so nobody adds the work.

## `execute`

**Why `--source jira` imports to a plan file instead of executing against the
tracker.** The plan file is already the execution state — resume reconciles
against it, the estimate loopback reads `Estimate` off it, the milestone gate
takes the union of `Files` from it, and the archive moves text within it.
Executing off a tracker means reimplementing every one of those against a
second state store that lives behind a credential, and then keeping the two
implementations in agreement forever. Importing costs one beat at the head of
the run and leaves exactly one execution path, which is also why nothing after
the import knows the difference.

**Why the import fills `Estimate` and `Commands` but stops on acceptance
criteria.** The first two are derivable here with no judgement: `estimate.mjs`
already buckets a ticket from its tags and stack, and the discovery record
already holds the commands. Acceptance criteria aren't derivable — a tracker
ticket says "add rate limiting to the auth routes", and turning that into
`a 6th request inside 60s returns 429` is a decision about behaviour, not a
transcription. Inferring it would hand the developer a bar the run invented for
itself, and an invented criterion reads exactly like a real one on the page.
That's the skill's "never assume a default" rule landing on the one field the
whole TDD cycle turns on.

**Why status writes back during a run when the export refuses to.** Same fact,
opposite conclusion, because the two acts differ in what they know. An export
sets a status once and walks away, so it is wrong within an hour and reads as
live to everyone looking at it. A run knows each transition at the moment it
happens, so the value it writes is true when written and updated when it stops
being true. It stays a label even so: the workflow column belongs to the team's
process, not to qoq, and in Trello a list position is already carrying the
milestone.

**Why there's no per-ticket standards pass and no complexity-driven routing
table.** Complexity rates the model and nothing else, so a `trivial` ticket and
a `judgment-heavy` one run identical steps at different tiers. A per-ticket
semantic code review was considered and declined for the same reason: it
duplicates the milestone `refactor` at a worse altitude, one agent round per
ticket. The test-integrity gate was kept precisely because it has _no_ duplicate
at any altitude.

**Why there are two refactor beats rather than one.** They answer different
questions at different scopes and neither substitutes for the other. The
ticket-level tidy is ordinary TDD — the developer's own diff, still warm, inside
its own `Files`, no interface change. The milestone-level beat is `qoq refactor`
over the union of every ticket's files, and it's the first moment those tickets
exist as one piece of code: duplication across four tickets, a now-dead export,
three tickets that each picked a different shape are invisible at any smaller
scope. This file previously said the third beat belonged _only_ to the milestone,
on the grounds that per-ticket scope is too small to see anything. That was true
of the second question and false of the first, and a developer that never tidies
hands the milestone gate a mess it was never meant to sort.

**Why the test-integrity gate is a new read-only agent and not a mode on
`qoq-tester`.** `tools:` is declared once per agent file. `qoq-tester` needs
`Write, Edit` to do its writing job, so a review mode living in that file would
carry `Write, Edit` into the review pass — and the standing rule is that an agent
permitted to report and fix will quietly do both, with the finding disappearing
into the diff. A dual-mode tester breaks that by construction. The two would also
share nothing but `test-conventions.md`, which both read from disk anyway, so the
"reuse" buys no code — only a shared filename.

It's an agent rather than a read on the orchestrating thread for two reasons: the
reading volume is what dispatching exists to keep out of that context, and the
orchestrator is holding the developer's own report, which primes it to accept. A
cold reader isn't primed.

**Why the gate sits before the commit rather than at the milestone.** This was
moved to the milestone at one point on cost, and moved back, because the cost
argument was buying the wrong thing. A ticket marked `done` whose tests assert
nothing isn't a deferred problem — it's a false statement the plan file
propagates: a `success` filed with the estimator, downstream tickets built on a
behaviour nothing pins, an archive entry claiming delivery. Catching it a
milestone later means unwinding all three. Cross-ticket spec problems genuinely
are milestone-shaped, but they need nothing extra: the milestone `refactor` runs
over the union of every ticket's files, specs included, and its first assessment
is a duplication detector.

**Why a rejection can unlock an edit the developer is otherwise forbidden.**
Without the exception the gate has one output. Every defect it can find — an
assertion that cannot fail, a shape asserted from the implementation rather than
the contract — is repaired by editing a green assertion, so a rejection would
re-dispatch a developer forbidden from acting on it, burn the shared budget, and
end `blocked`. A gate that can only produce blockers is a blocker generator. The
prohibition is on _self-initiated_ edits: the agent alone with its own
implementation, deciding an assertion should expect something else. A `REJECTED`
verdict is the opposite — an external reader, without the implementation in
context, naming a specific assertion as defective — which is why the licence is
scoped to exactly the assertions the verdict cites.

**Why the three attempts are shared across both gates rather than three each.**
The budget is a property of the ticket. Three rounds of feedback and still not
right means the ticket is mis-rated, whichever gate said so, and that's exactly
what the escalation ladder acts on. The obvious objection — a ticket burns its
attempts on trivia and has nothing left for the harder semantic feedback —
doesn't hold, because Gate 1 spends a budget of its own first: `qoq fix` is a
check/**fix** loop that runs three internal rounds, fixes what it can, reverts
any fix that breaks a test, and returns `FAIL` only on what survived all of it. A
Gate 1 `FAIL` is never "prettier complained". Separate counters would also allow
six rounds before the tier moved, and the estimator takes one number anyway.

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
out of the gate living with the caller — the only thread that has a digest and
can re-dispatch — and it's the better place regardless: nothing reaches history
until it has passed, and "one ticket, one commit" stops depending on an agent's
discipline.

## `test`

**Why N slices means N full-suite runs.** Each slice ends with a run whose whole
purpose is attribution. It's the same trade `bump` makes one patch at a time,
for the same reason: a check that can't say which change broke it isn't a check.
