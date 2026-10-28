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

| Topic                                         | Spec                             |
| --------------------------------------------- | -------------------------------- |
| [The discovery record](#the-discovery-record) | `references/discovery.md`        |
| [`fix`](#fix)                                 | `references/fix.md`              |
| [`refactor`](#refactor)                       | `references/refactor.md`         |
| [`bump`](#bump)                               | `references/bump.md`             |
| [`plan`](#plan)                               | `references/plan.md`             |
| [`replan`](#replan)                           | `references/replan.md`           |
| [`execute`](#execute)                         | `references/execute.md`          |
| [`test`](#test)                               | `references/test.md`             |
| [`document`](#document)                       | `references/document.md`         |
| [`mermaid`](#mermaid)                         | `references/mermaid.md`          |
| [Code conventions](#code-conventions)         | `references/code-conventions.md` |

## The discovery record

**Why it's cached at all.** One JSON file, six consumers, derived on the main
thread only when the file can't be trusted. No command re-derives any of it, which is
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

**Why `entry.mjs` is injected rather than called.** SKILL.md runs it through
dynamic context injection (`` !`…` ``), so its output is already in the skill
text when the thread first reads it: one tool round trip fewer on every run, and
"once, at the head" stops being an instruction a thread can skip. Injection
aborts the invocation on any non-zero exit, which is why a missing or unknown
command is a `command` section on exit 0 rather than a usage error — it's a
question for the user, and the thread runs the printed line itself once it has
the answer. `$ARGUMENTS` sits in the body because a skill that uses `$0` no
longer gets its arguments appended, and the scope and flags still have to reach
the thread.

**Why `<skill>` is `${CLAUDE_SKILL_DIR}`.** The thread used to be told to pass
"this skill's absolute path" with nothing to read it from. Substitution gives it
the path literally — but only in SKILL.md, so references and agents keep
`<skill>` and every dispatch still carries it. Through `.claude/skills/qoq` the
substituted path is the symlink, which is why `usage-check.mjs`'s main-module
guard compares real paths: raw, it silently skipped its body and the spending
gate exited 0 having fetched nothing.

**Why the `npx` rule is a hook.** Prose says why; the `PreToolUse` hook in
SKILL.md's frontmatter makes it hold, including inside agents, since skill hooks
apply to every tool call for the rest of the session. It's inline `node -e`
because hook commands get no `${CLAUDE_SKILL_DIR}`, and the plugin and the
symlinked checkout keep the script in different places. `npx-guard.node-test.mjs`
runs the command exactly as the frontmatter ships it. It matches `npx` anywhere
in the command string, so a commit message quoting `npx vitest` is blocked too;
rare, and the message says why. It has no exception for an `npx` the project's
docs give, either. Discovery used to record one as an answer, which left a field
the hook would never let run. Now it asks for a script that wraps it.

**Why the bumper starts at the repository URL.** `@ladamczyk/outdated` (run
through `qoq`'s npm check, so the skill never needs a second `npx`) already hands over each package's `repository`, so the changelog is one shallow clone
away — greppable, with real tags, instead of a search that has to find the right
repo first. `WebSearch` stays as the last rung for packages that ship nothing
readable there, not as the default.

**Why the agent frontmatter says what it says.** `qoq-checker` runs at
`effort: low` — it runs tools and digests, nothing to deliberate. `qoq-checker`,
`qoq-bumper` and `qoq-designer` set `omitClaudeMd`, because everything they act
on arrives in the dispatch or is read from code; `qoq-test-reviewer` doesn't,
because its dispatch never names the project's own conventions file, and
"the project's file wins" is often met through CLAUDE.md. `qoq-architect` pins
`effort: high`, so a low-effort session can't quietly thin the contract every
ticket inherits. `qoq-developer` and `qoq-tester` cap `maxTurns` at 200: the
longest developer run measured was 122 turns (median about 35 over 24 runs); no
tester runs were on record, so it takes the same cap.

**Why the read-only tiers are what they are (audited 2026-10-21).** A tier only
moves on a measured difference, and none of these showed one:

| Agent               | Tier       | Tested against              | Quality                                                                                                                                          | Cost (median context tokens, wall time) | Decision |
| ------------------- | ---------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | -------- |
| `qoq-test-reviewer` | sonnet     | opus, 6 cases × 3 runs each | 0/15 seeded defects missed and 0/3 false rejections on both tiers                                                                                | sonnet 60.6k, 10.8s · opus 76.5k, 21.6s | keep     |
| `qoq-designer`      | sonnet     | opus, 2 cases × 2 runs each | both tiers: the one real smell found (Strategy, Record as the cheaper fix), zero findings on the clean scope, no low-confidence padding          | sonnet 77.5k, 14.0s · opus 90.7k, 25.6s | keep     |
| `qoq-checker`       | haiku, low | 46 real runs, transcripts   | 0 of 159 digest locations dropped. 1 miscounted in-scope total (`haiku-4-5`); 0 errors in 29 `haiku-5-5` runs. `summarize.mjs` does the grouping | median 1.7k output tokens               | keep     |

The reviewer's cases are `evals/qoq-evals.json` 26–31, over
`evals/fixtures/test-reviewer`. Each seeded spec survives a mutant of the
implementation that the sound spec fails, so every defect is real. The cases are:
a missing criterion, a tautological `>= 0`, an `expect` inside a callback over an
empty filter, a mock asserted against itself, and a value pinned only by
`toBeGreaterThan(0)`. That last one was added when the first four didn't separate
the tiers, and it didn't separate them either. The designer's cases are 32–33.
Production agrees: 41 real sonnet reviews, of which 9 were rejections, each fixed
and then approved.

**What this doesn't prove.** The fixtures are one small file each, and every case
hit 100% on both tiers. That is a ceiling, not a margin. A harder fixture, such as
a multi-file ticket or a contract that diverges from the implementation, is what
would show a gap. Re-run 26–33 at both tiers whenever the reviewer's or the
designer's prose changes.

**No `effort` on the judgement agents.** Both tiers ran at default effort and hit
the ceiling, so raising effort has no measured headroom to buy. `qoq-architect`'s
`effort: high` stands on its own reasoning above.
`qoq-bumper` (3 runs on record) and `qoq-tester` (none) weren't measured, so they
keep their current tiers by default.

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

**Why Knip is the one tool with an opt-out.** Every other tool answers a question
about the file in front of it, so scoping the verdict by reading the digest is
exact. Knip answers a whole-repo question — is this export reachable — which the
digest can attribute to a file in scope but cannot recompute for a scope. That
makes it the only tool whose verdict depends on code that isn't written yet, and
`--skip-knip` exists for exactly the callers that know it isn't: `execute`
mid-milestone. The narrower alternatives were considered and don't work — a Knip
ignore list would have to be maintained per ticket and would outlive the plan,
and reading the finding and deciding to ignore it puts the judgement on the
thread most primed to accept the deletion.

**Why the skip deletes `knip-report.json` rather than only passing the flag.**
`summarize.mjs` reads each report off disk by name, unconditionally. A skipped
run leaves the previous full run's report in place, so the digest would carry
Knip findings computed against a tree several tickets old — the skip would appear
to work while making the false positives worse. Deleting the file is also what
keeps `reports-current.mjs` honest, since its oldest-report rule would otherwise
call the whole set stale on every loop.

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

**Why `bump` runs `qoq scan` at all.** The CLI already sends people to `/qoq
bump` when `scan` finds something, and before this `bump` only read the
outdated report, so a vulnerable package with nothing newer in range never made
the plan. `scan` stays out of `--check` because it's a network call with no
throttle. `bump` is already on-demand, so the cost lands where someone asked
for it.

**Why the parent bump comes before an override.** A newer parent that already
depends on the fixed version is a combination its author released and tested.
An override forces a version under a parent that never declared it, which is
the usual way overrides break things at runtime with nothing failing at
install. Scoping the override to the parent and keeping it inside the parent's
declared range limits that, but doesn't remove it, so it stays the fallback.

**Why `npm view` only for declared ranges.** `npm-report.json` already has
`current`, `latestInMajor` and `latest` for every direct dependency, and the lockfile
already has each installed parent's declared ranges. Asking the registry for
either again is a second, possibly disagreeing, answer to a question already
answered. What neither holds is the range a release that isn't installed
declares, and that's the only thing that proves a parent bump fixes a
transitive finding. One `npm view` of `latestInMajor` answers it, and that's
the target the minor/patch group already plans, so a security fix and an
ordinary update never disagree about where a package goes.

**Why `via` carries both `direct` and `parent`.** They answer two different
questions. `direct` is what `bump` can edit, the name in a `package.json`.
`parent` is what a scoped override is keyed on. They're the same only one level
down. `manifest` comes along because in a workspace the `direct` to bump is
declared in the member's `package.json`, not the root's.

**Why existing overrides are tested after the bumps, not stripped first.** An
override nobody re-checks outlives its reason: the parent ships the fix and the
pin keeps holding the tree back. Stripping them all up front and re-adding the
needed ones would catch that too, but a red patch would then have two possible
causes, the bump or the missing pin. Testing each one alone, once the bumps are
green, keeps every failure attributable. Only those in the chosen packages'
subtree are tested, because removing any other re-resolves a part of the tree
the user didn't pick.

**Why validation compares against a baseline.** "`qoq fix` green after every
patch" assumed a clean project. With existing lint debt, green can't be reached
without fixing code the bump never touched. An eval run on the fixture, which
starts with three findings, showed what happens next: the agent ran `qoq fix`
once, saw findings in untouched files, and quietly stopped running it. A
baseline keeps the check running on every patch and keeps the patch's edits
its own. `test` and `build` don't get one: a red suite before the first patch
can't attribute anything, so it's a precondition like the clean tree.

**Why dropping an override needs both a clean scan and green validation.**
Overrides aren't all security. A pin for compatibility or deduplication has no
advisory to clear, so a clean scan alone would drop it, and the breakage would
show up later with no obvious cause.

**Why the scan is opt-in.** Planning from `qoq scan` pulls in a lot at once:
OSV lookups that need the network, transitive fixes proven with `npm view`,
override suggestions, and override-removal testing after the bumps. That's all
new and still settling, so it's off unless asked for, with `--scan` for one run
or `future.unstable_skill_bump_with_scan` for a project. Off is exactly the
pre-scan behaviour: the outdated report alone. The plan says the scan is off,
because a plan with no vulnerabilities in it would otherwise read as a clean
bill of health.

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

**Why the trackers are experimental, and switched per project.** Only `local`
has evals behind it; the Jira, Linear and Trello paths run against MCP servers
nobody here has exercised end to end, and they write to people's real trackers.
So each needs `future.unstable_skill_plan_<tool>: true` in `qoq.config` — a
project's decision, checked in — and the `--tool` flag alone is never enough.
It's checked before the grill, not at the export beat: a stop after approval
would spend a whole planning session to find out. `execute --source` imports from
the same trackers through the same untested servers, so it sits behind the same
switch — one decision per tracker, both directions, rather than six names for
three integrations.

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

**Why progress is a plugin band and nothing in the skill.** A first version had
the agent run a board script at each ticket and milestone. Eval runs showed it
treated the output as its own context: it never relayed the board, chained the
call with other reads, and each call cost a tool turn. `hooks/register.tsx`
needs no agent: it starts when the session touches an approved, in-progress or
complete `plans/*.md`, rereads it after every tool call, and draws above the
prompt. A host without plugin bands, or a skill copied into `.claude/skills/`,
shows no progress, and the skill loses nothing it relied on.

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

**Why the ticket gate is the one that gives up a tool, and the milestone gate is
the one that gets it back.** A Knip finding mid-milestone is a statement about a
repo that is deliberately half-built: an export ticket 4 consumes is unreachable
while ticket 3 is the newest code on disk. Acted on, the gate sends the developer
back to delete what the plan told it to build — and the developer, holding a FAIL
digest and no view of the plan, has no way to know the finding is wrong. Held to
the milestone gate, the same check runs over a tree where every ticket exists,
and what it reports is real: something built and never consumed, an export
stranded by a shape that changed mid-milestone. The cost is one milestone of dead
code sitting in the tree, unreleased; the alternative was per-ticket rounds spent
undoing correct work. That is the same argument the milestone refactor already
makes — cross-ticket questions get answered at cross-ticket scope — reaching one
tool inside `fix`.

**Why the commit skips the project's own hooks rather than asking the user to
configure them.** `--no-verify` is the only lever `execute` holds. A pre-commit
hook belongs to the project and is shared with every human committing to it, so
the alternatives are telling the user to weaken a gate their team relies on for
the duration of a plan run, or detecting hooks and reasoning about what each one
does. The run already knows something no hook can: that these exact files passed
these exact tools seconds ago, and that Knip's answer is false until the
milestone completes. Skipping verification it has already performed is a
narrower claim than it looks — the checks aren't dropped, they're the two gates,
plus the full unscoped pass at the milestone. What the run gives up is a hook
firing on work the run itself verified.

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

**Why the developer's and the tester's returns end on a fixed block.** Their
callers act on them mechanically — a status picks gate or escalation, a file list
becomes a gate's scope and a commit, a blocker is forwarded to the next tier or
quoted to the user. Free prose made the orchestrator re-read a report to find
those, and a file list fished out of a paragraph can silently drop
a spec, so the gate scopes short and the commit misses it. The block is defined
once, in the agent that writes it, and the callers name fields without restating
it, so the two can't drift. It holds only what a caller reads: "what the specs
cover" went, because criteria are ticked from the reviewer's mapping, and "what
the suite said" went, because `green` already means the suite agreed. The status
stays binary: a `partial` would be a third branch every caller has to invent
handling for, and nearly-green work is a handoff with what's on disk listed.
`qoq-checker`, `qoq-test-reviewer` and `qoq-designer` were already shaped —
`summarize.mjs` plus its exit code, `APPROVED`/`REJECTED`, a per-finding table —
and were left alone.

**Why a handoff escalates at any attempt.** The developer hands back only when
it has decided it can't finish. Re-dispatching the same tier with the remaining
attempts asks the same model the question it just answered.

**Why a `plan` handoff doesn't escalate.** A wrong Contract or an unassertable
criterion is a blocker no tier can lift, because no tier may change the ticket.
Escalating spends an opus attempt to get the same blocker back. Eval 24's run on
2026-10-21 showed it: the orchestrator refused the escalation the rule asked for
and asked the user instead. `blocker_kind` makes that judgement call the rule. A gate FAIL is different: that's
feedback the developer hasn't acted on yet, so it stays on the shared budget.

**Why a same-tier re-dispatch carries the last return, not just the verdict.**
Each attempt is a cold dispatch, and the verdict says only what is wrong; the
return's prose is where the developer said why it went wrong. Without it attempt
3 can retry attempt 1's idea. A dedicated `diagnoses` field was benchmarked and
dropped: developers already name the cause in prose, and the rule changed neither
attempts-to-green nor repeat rate.

**Why the commit happens after the gate rather than inside the agent.** It falls
out of the gate living with the caller — the only thread that has a digest and
can re-dispatch — and it's the better place regardless: nothing reaches history
until it has passed, and "one ticket, one commit" stops depending on an agent's
discipline.

## `test`

**Why N slices means N full-suite runs.** Each slice ends with a run whose whole
purpose is attribution. It's the same trade `bump` makes one patch at a time,
for the same reason: a check that can't say which change broke it isn't a check.

## `document`

**Why the tier follows the mode.** Plan mode is handed the intent — the
milestone text says why — so its work is translation and sonnet does it. Path
mode is archaeology on code nobody explained, and an inference error there is a
confident wrong reason written into the repo, where the next reader has no cause
to doubt it. Same agent, same contract, different difficulty; the caller knows
which, so the caller passes it — the `qoq-developer` mechanism, not a pin.

**Why after the milestone gate and before archive.** Docs written before the
gate describe code the gate may still change. After archive, the milestone text
— the scribe's whole source of intent — has moved out of the plan. The gap
between them is the one moment both the final code and the plan are in hand.

**Why only prettier, not `qoq fix`.** The scribe adds comments and Markdown and
nothing else. The only tool that has an opinion about either is prettier, which
reflows JSDoc; a full fix loop would spend a checker dispatch to rediscover that.

**Why the ownership marker names its sources.** A fresh-context scribe can't
tell its docs from a human's, nor which code a doc describes — and "touch only
docs whose source changed" needs both. One first-line comment answers both and
stays greppable. Hand-written docs are listed in Contents but never edited: the
scribe may read them, and that's all.

**Why drift is report-only.** A delivery that diverged from the plan is either a
bug or a better decision, and only the user knows which. Writing it into `docs/`
would make the docs carry an argument the user hadn't had yet, and would outlive
whichever way it went.

**Why diagram candidates live in the report.** A marker in the docs would be
something the scribe writes and a second agent deletes, and it would outlive the
run whenever diagrams are off. A report field costs nothing until `qoq-artist`
reads it, and nothing at all when it doesn't run.

**Why opt-in inside `execute`.** It's experimental: the scribe's judgement about
what deserves a comment hasn't been tested across many codebases yet, and
`execute` runs unattended, committing what it writes. A bad comment that lands
nine milestones deep is expensive to find. So the step is off unless someone
asked for it: `--docs` for one run, `future.unstable_skill_docs` in `qoq.config`
for a project that has decided. The `unstable_` prefix says the contract can still
change. Standalone `/qoq document` needs no switch, because typing it is the
opt-in.

**Monorepos are a pilot limit.** One root `docs/` and one `Contents`, like any
repo. Per-package docs are a real design question — where a cross-package
workflow lives — that waits for a project that needs it.

## `mermaid`

**Why the default is not to draw.** A chart that restates its paragraph is a
second copy of it that the reader has to check against the first, and the first
copy is the one that gets updated. The artist earns its place on structure prose
handles badly — a branch, a lifecycle, five components over time — and a
pipeline run that declines everything has done its job. Standalone is the
opposite because a person asked for the picture.

**Why sonnet, pinned.** Deciding whether to draw and which chart fits is
judgement, but it's judgement over prose that's already structured — a plan or a
scribe doc — not archaeology. Emitting valid syntax is the mechanical half, and
the validator owns it, so the tier doesn't have to. Splitting the two across a
strong and a cheap agent would cost two dispatches per chart to save on the
cheaper half.

**Why the validator is a skill script, not a CLI command.** The qoq CLI
orchestrates linters over a codebase; Mermaid is a concern of one skill command.
A CLI dependency on mermaid and jsdom would be downloaded by every qoq user,
diagrams or not. The script installs a pinned pair once per machine into the OS
temp dir — `npm install`, because the skill's hook blocks every `npx` but qoq —
and runs offline after. `mermaid.parse()` is GitHub's grammar without the
browser; the CLI renderer would add a headless Chromium for layout fidelity
nobody needs to know a chart renders. What parse-only misses — a label starting
with a backtick parses and then breaks GitHub's render — is in the agent's list
of traps.

**Why an unvalidated chart is still written.** Exit 2 means the validator
couldn't be installed, not that the chart is wrong, and a machine offline on its
first run would otherwise never get a chart. The marker says `unvalidated`, the
report says so, and the next run that can validate clears it. A chart that
_failed_ to parse is never written.

**Why an id marker, and never a hand-drawn chart.** A rerun has to find its own
chart to replace it, or every run appends a duplicate. The marker is that handle,
and it's also the only way a fresh-context agent can tell its chart from a
person's. A person's chart encodes a choice the artist can't see, so it's read
for style and reported when stale, never edited — the same line the scribe draws
around hand-written docs.

**Why a budget.** One chart per heading, three per file. Without a cap a long
doc gets a chart per section, and a page of charts is read like a page of text:
not at all. The cap forces the choice the restraint rule asks for.

**Why plan charts sit above the milestones and freeze.** `execute` passes
milestone text into every developer dispatch; a chart there is paid for in each
one and acted on by none. Above the milestones it's read once, at approval,
where the user approves the shape along with the text. It then records what was
approved; the docs charts drawn after each milestone record what was delivered,
and the difference is information `replan` uses rather than noise `execute`
should erase.

**Why one switch, and why execute also needs docs.** `--diagrams` and
`future.unstable_skill_diagrams` turn on every pipeline call site — the same
experimental, opt-in reasoning as docs. In `execute` the artist's input is the
scribe's report, so diagrams without docs has nothing to draw from; it says so
in the opening line rather than asking, because nothing breaks. `/qoq document`
only offers: path mode is attended, and a chart the user didn't ask for is a
second review they didn't sign up for.

## `sheriff`

**Why per milestone, not per ticket.** The finding this agent exists for is the
one no single ticket contains: an endpoint in one ticket, the missing check in
front of it in another. A per-ticket sweep sees each half alone and calls both
clean, and pays a session-tier read per ticket to do it. The per-ticket sweep
stays as an exception the user confirms at approval, and it never shrinks the
milestone sweep, for exactly that reason.

**Why after the gates, and before the scribe and the reviewer.** Earlier, its
judgment is spent on code the refactor and the fix loop are about to rewrite.
Later, the scribe documents code a remediation is about to change, and the
reviewer would read a diff that isn't final.

**Why the session's model, always cold.** Security review is pure judgment, and
the failure that matters is a miss, which no later gate catches. The author's
model and context carry the author's blind spots, so the sweep never inherits
them: a fresh dispatch every time, never `SendMessage`. There's no "raise" field,
because execute's ladder already stops at the session's model.

**Why ESLint's resolved config is the line, not "what Sonar catches".** qoq has
no Sonar gate; its mechanical security layer is ESLint with sonarjs, already run
over every file. Reading which rules are enabled is checkable, and
`skipped_covered` shows the reasoning. "What a scanner would probably catch" is
a guess, and a guess that's wrong drops a real finding.

**Why confidence routes and never gets promoted.** Severity says how bad it is
if it's real. Confidence says whether anyone meant it, and only the user knows
that. An agent that promotes an ambiguous finding to make it actionable has
decided intent for them, and a fix for something intended breaks a feature on
purpose. So confirmed critical/high goes straight to remediation, an ambiguous
critical/high stops the run (the next milestone would build on it), and
everything else waits for the end-of-run walkthrough, so an unattended run keeps
going.

**Why remediation is a new ticket, with its own budget.** The ticket that wrote
the hole is delivered and green, and reopening it would re-grade it with the
estimator. A narrow ticket reuses everything `qoq-developer` already guarantees
(a red spec first, Gate 1, Gate 2), so the fix is pinned by a test. Its two
rounds are counted apart from delivery attempts: "the ticket was hard" and "the
fix didn't work" are different failures, and one budget would let a hard ticket
starve its own security fix.

**Why the scope check is by file, and mechanical.** "Change nothing else" is a
rule a model can talk itself out of under the banner of security. A file-set
comparison can't be argued with. Hunks are left to the recheck because a fix
legitimately moves lines and adds an import at the top of the file, and a
region rule would reject correct fixes.

**Why no refactor in the re-gate.** `--decisions auto` applies its safe tier
unattended, and safe for shape isn't safe for a security fix. A dedupe that
merges the fixed path with an unfixed sibling undoes it without failing a test.

**Why accepted risks are inline markers.** A ledger file drifts the moment code
moves, and a later sweep can't tell which entry a renamed function belongs to. A
comment moves with the code, is visible to the next human, and has a mechanical
expiry: the sheriff re-raises when a diff touches the marked block, quoting the
reason it was accepted for.

**Why a broken premise re-raises an untouched marker.** An acceptance is a yes
to a stated reason, not to a location. When another finding falsifies that
reason, for example a role check that was "the whole guard" while the role is
forgeable, the yes no longer covers anything. The diff rule alone would keep
the marker silent until someone happened to edit that block, which may be never.
It comes back `ambiguous`, never `confirmed`, because the user may still accept
it on a different reason, and that decision is theirs.

**Why opt-in inside `execute`.** Same reason as the scribe: it's experimental,
and inside `execute` it runs unattended and can stop a run or commit fixes. A
miscalibrated sweep nine milestones deep is expensive. `--sheriff` turns it on
for one run, `future.unstable_skill_sheriff` for a project. Standalone
`/qoq sheriff` needs neither, and it only prints until the user says yes.

## `review`

**Why per milestone, with the plan pass kept light.** A wrong turn is cheapest
to fix before the next milestone builds on it, and that is the moment the
milestone review exists for. The end-of-plan pass doesn't repeat it. It asks
only whether the milestones add up to the plan, which is answered from the
Completed blocks and a `--stat`. A full re-read there would be a second code
review at session cost, over code that was already reviewed.

**Why after the sheriff, before the scribe.** The reviewer should judge the diff
that ships, security fixes included, and the sheriff's loop can still change it.
The scribe should document code no one is about to change, and a review fix
changes it.

**Why the session's model, always cold.** It is the same argument as the
sheriff's. Plan fit is pure judgment, and the author's context is exactly what
makes a wrong turn look right. There's no raise field because the session is
already the ceiling.

**Why acceptances live in the plan, not in the code.** Scope and plan fit only
mean something inside the plan that set them. A marker saying "accepted scope
creep" is noise to every later reader of the file. The Review line carries the
anchor and the reason, which is everything the sheriff's marker carries, and
it's the expiry rule's input. Standalone has no plan, so it has no accept either:
a re-raise there is honest, not a bug.

**Why the sheriff takes a pull request as well as paths.** A security read
needs no stated intent: a snapshot of existing code is still a fair audit, so
paths and ranges stay. A pull request adds a description, which turns some
`ambiguous` findings into `confirmed` ones. Both commands resolve a PR through
the same steps, so they read it the same way. They stay separate commands
because one is a plan-fit judgment and the other a security one.

**Why standalone review takes a pull request link, not paths.** The reviewer's
question is whether a diff matches what it set out to do. A path snapshot has no
diff and no intent, and `sheriff` and `refactor` already read code as it stands.
A pull request has both: the diff, and the title, description and closed issues
that stand in for a plan.

**Why a link and not a number, and a scratch clone.** The user reviews pull
requests across many repositories from one machine. A number means nothing
without a repository, and the working directory usually isn't the right one. A
link carries its repository. The clone sits in the OS tmpdir, so the user's
checkouts are never touched, and discovery is skipped because the working
directory's record describes another project.

**Why proposed comments, posted only on a pick, and never a verdict.** The
comments go out under the user's GitHub name, so each one is the user's to
send, edit or drop. They're drafted the way a colleague would write them,
without finding ids or tool branding, because that is who signs them. One
`COMMENT` review keeps a run to one notification for the author, and inline
placement puts each point next to its code. `APPROVE` and `REQUEST_CHANGES` are
judgments the user gives on GitHub, not a side effect of a report. There's no
remediation in this mode: it's someone else's branch, possibly in someone else's
repository.

**Why traceability defines scope creep.** "Did they need this?" can't be
answered from a diff. "Does this hunk trace to a criterion, a Contract or the
Goal, or is it forced by one that does?" can. When a hunk is forced in a way the
reviewer can't demonstrate, the finding is `judgment` rather than `confirmed`,
because the author may have seen a reason the reviewer can't.

**Why maintainability is capped at medium.** `high` stops the run, and stopping
an unattended run is only worth it for something the next milestone will build
on. A misplaced helper costs the next change, not the next milestone. If one
could stop a run, the user would learn to skip the stops.

**Why remediation tier follows the category.** Removing an untraced export is
mechanical. Bringing a delivery back to its Contract is a design call. A fix
that changes a Contract or spans more than five files is rework of the plan, so
it goes to `replan` and not into a two-round patch loop.

**Why the sheriff rechecks a review fix, and the chain ends there.** A refactor
done for consistency can drop a guard and still pass every test. The sheriff
reads only that diff, which is cheap. Ending on the sheriff, with no second
reviewer pass over a security fix, keeps two agents from correcting each other
forever. The security fix is already scope-checked by file.

**Why the sign-off is rendered by the main thread.** The agent sees its own
report. The sign-off also needs the other gates' evidence and the user's
decisions from the walkthrough. Keeping the agent's output typed and having the
main thread render the summary means neither one has to be shaped for the other.

**Why opt-in inside `execute`.** It is the same reason as the sheriff and the
scribe. Inside `execute` it runs unattended and can stop a run or commit fixes.
`--review` turns it on for one run, and `future.unstable_skill_review` turns it
on for a project.

## Code conventions

**Why names, not comments, carry the what.** A comment that restates the code is
a second copy of it, and only one of the two copies gets updated. A name is the
one copy that the compiler, the reviewer and every call site see. So the skill
pushes meaning into names, and `qoq-scribe` is left with what only prose can
hold: decisions, edge cases, constraints. That's also why the scribe's docs can
stay short.

**Why the principle and not a rulebook.** Casing, allowed abbreviations and name
length are mechanics, and mechanics belong to ESLint, where they're checked on
every run instead of re-read by every agent. The skill states the intent and lets
the project's config own the details.

**Why an old comment is evidence.** The commit, ticket or conversation that
explains a decision is often gone by the time someone reads the code, and the
comment is what's left. Every deletion pass — a developer's tidy,
`ponytail-review`'s whole job, a compress instinct — sees it as clutter. So
removal needs a reason that holds on its own (false, or now carried by a name,
type or test), the text is quoted into the commit body so history keeps it, and
nobody removes one unattended.
