# QoQ fullstack — why it's built this way

Maintainer reference for [`skills/qoq-fullstack`](../skills/qoq-fullstack/SKILL.md),
not the spec. Nothing here is loaded at run time. When a rule changes in the
skill, its argument changes here in the same commit. The protocol side, inside
`qoq`, is argued in [qoq-design.md](qoq-design.md#a-plan-under-a-feature).

**Why a separate skill.** `qoq` already routes thirteen commands. The chief of
staff is only needed by people who work across repos, so it gets its own
trigger description and plugin, and nobody else loads it.

**Why it finds the status script next to it.** Every plugin install is a full
copy of the repo, so `../qoq/` next to this skill is always `qoq` at the same
version. The docs don't promise that layout, so the entry stops if the path
doesn't resolve, rather than guessing.

**Why the scripts are split between the two skills.** A script lives with the
skill whose sessions run it. A repo session asks `feature-status.mjs` whether
its next milestone may start, and the band draws from `feature-state.mjs`, so
both stay in `qoq`, along with the loader they share. Only the chief of staff
prints the status tables or reorders rows, so `status.mjs` and `schedule.mjs`
live in `qoq-fullstack`. They import `qoq`'s core through the same `../qoq/`
path rather than copying the rules, which keeps one definition of what may
start.

**Why one session per repo, not agent teams.** As of 2026-11, agent teams were
experimental and interactive-only. Every teammate shares the lead's working
directory, so it doesn't load its own repo's CLAUDE.md, `qoq.config`,
discovery record or agents. A dead lead also loses the team. Independent
sessions started with `claude --bg` each start in their own repo and survive
the chief of staff dying. Cross-session messaging plus `notify_when_idle` is
the whole coordination channel that's needed.

**Why a report per ticket, and a heartbeat.** In a real run (learning record
30, 2026-11), a repo session committed four tickets and sent nothing, because
the launch prompt said how to report but not when. At the milestone gate an
external review skill's reply-to-the-user format then became its final text
and ended the turn. Its idle notice never arrived either, because it ran in a
different permission mode and the session list kept showing it busy. A
background session's final text reaches nobody, so the report cadence is
spelled out and every turn ends on a `SendMessage`. The rules are copied word
for word, because in an eval a paraphrased instruction message dropped the
"never end silently" half. The 30-minute heartbeat
covers a session that hangs or dies, which no rule inside that session can.
It nudges once, then asks the user, and never restarts the session, because a
session still listed as busy would make two writers in one checkout.

**Why the master plan is business-only.** The chief of staff has read none of
the repos. A technology decision made there would bind code whose conventions
it hasn't seen, and each repo's `qoq plan` would then have to either obey a
wrong call or quietly overrule it. So technology questions are parked under a
role and asked by the repo that owns them, against its own code.

**Why the files are the state.** Messages can be held, dropped, or sent by a
session that died a line later. A repo writes its plan file before it
messages, and every decision rebuilds from disk with `feature-status.mjs`. So
a restarted chief of staff, a restarted repo session and `feature status` all
see the same answer. The same script answers a repo's own `qoq execute`, so a
session running on its own can't start work the feature hasn't unblocked.

**Why a master milestone gates on integration, not on repo delivery.** Each
repo's gate proves its own side of a contract. Only running the repos together
proves the contract holds between them. So `delivered` on a master row is
written only after that check passes, and it's the only write that lets the
next master milestone's repo work start.

**Why the parent folder isn't a repo.** A git repo containing the repos it
coordinates is either submodules or nested repos. Both make a repo's history
depend on a folder the repo knows nothing about. The feature files are
coordination, not product, and each repo's plan holds that repo's history.

**Why `feature.json` and not YAML.** The skill ships no dependencies, and
Node's standard library parses JSON.

**Why the models split the way they do.** `plan` recommends Opus, because the
business grilling and the BRD are the judgement-heavy part. `execute`
recommends Haiku, because there the chief of staff only coordinates: it reads
the status script, wakes repos, and relays questions word for word. `status`
recommends nothing: it's one script call, and the thread's context, not the
model, is what it costs. Every technical decision is made in a repo session,
and those start on `feature.json`'s `model`, recommended `opus`. It's a field
for the same reason `permissionMode` is: N repos run N sessions at once, so the
spend is the user's call, made once, never inferred. On 2026-11-18, Haiku passed both execute evals. It believed the
files over a "be is done" message, and it relayed a technical question without
answering it, even though the repo leaned towards one answer. The skill can
only recommend the model for its own thread, because frontmatter `model:` would
apply to every sub-command, plan included.

**Why a spending limit is checked twice and asked once.** `--session-limit`
and `--weekly-limit` cap the account, and every session on it reads the same
number. The chief of staff checks before each loop round, so nothing new is
woken past the limit. Each repo gets the flags too, because only its own
per-ticket check can stop a milestone already under way. Since they all reach
the limit at nearly the same time, N copies of the same question would only be
noise, so it's asked once for the whole run. Quoting that one answer to a
repo that asks later passes on the user's decision, which keeps the rule that
this thread never answers a repo's question on its own. The flags last for one
run, as they do in `qoq`. A limit saved in the BRD or `feature.json` would
silently apply to the next run. Only these two flags are accepted. `--docs` and
`--diagrams` are per-repo choices. `--tool` and `--source` would put a tracker
next to the BRD's Repo plans table. A flag nobody forwards is refused up front,
because otherwise it would fail N times in sessions nobody watches.

**Why no worktrees.** By default a `claude --bg` session moves its edits into
`.claude/worktrees/<name>` on a branch of its own. The live test on 2026-11-18
showed the cost: the plan files in the repo's checkout never moved, so the
status script, the band and every cross-repo unblock were blind to finished
work. Delivery is plain branching, `feature/<slug>` in each repo's own
checkout, so setup turns isolation off per repo (`worktree.bgIsolation: "none"`)
and the launch prompt says that commits on that branch are part of the approved
plan.

**Why the chief of staff is the user's own session.** In the same test, a
background chief refused answers relayed from another session as not the
user's, which is correct. So answers have to be typed in the chief's own
thread, and that thread is the user's interactive session. Only the repos run
in the background.

**Why `permissionMode` is a field.** The Haiku chief in that test launched its
repo session in `default` mode while it ran in `auto` itself. A session in a
different mode holds incoming messages for approval, so the relay stalled.
The mode is now chosen once by the user and read from `feature.json`, never
inferred.

**Why every repo plans, and why "no changes needed" counts.** The master plan
names no repos, because whether a requirement lands in a repo is a judgement
about that repo's code, which the chief of staff hasn't read. So every repo in
`feature.json` plans, in its `after` order (for Trackbook: telemetry, then the
API, then the UI). A repo that finds nothing to do says so, and once the user
approves, its `none` row settles it. The repos after it then plan against its
existing contracts. Without that answer, a feature that doesn't touch telemetry
would leave the API waiting forever on a plan that never comes.

**Why a delivered milestone, not a ticket, unblocks another repo.** A finished
ticket hasn't passed the milestone gate (refactor, security sweep, full
suite), so a consumer building on it builds on unchecked code. The fine grain
comes from slicing instead: whatever another repo needs is its own small
milestone.

**Why the schedule is automatic.** Inside a repo, milestones run one at a time in
row order, and `execute` skips any milestone whose dependencies aren't
delivered. So row order between milestones that don't depend on each other is
pure sequencing. It changes no scope, so there's nothing for the user to
decide. `schedule.mjs` simulates the parallel run, with ticket count as duration,
and puts first whatever has the most work waiting on it in other repos. It
keeps the result only if the run gets shorter. A wait it can't remove needs a
milestone split, which is a replan the user asks for.
