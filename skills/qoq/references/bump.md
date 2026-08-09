# `qoq bump` — analyse, choose, then produce patches

Update npm dependencies without losing the ability to say which one broke
something. Everything here follows from that: one patch at a time, full
validation after each, and a split ladder instead of an abandoned group.

## A clean tree is a precondition, not a preference

Dirty tree → stop and say so. The whole design rests on `git` being able to tell
a bump's damage from the user's own uncommitted work, and it can't do that on a
dirty tree. This isn't a warning to proceed past.

## The plan is an impact analysis, not a patch set

The planning phase **writes nothing** — not the tree, not a patch file. It works
out what's outdated, groups minor and patch bumps, and plans **at most one major
step per package**. Majors (and any package queued from a previous round's
failure) get a `qoq-bumper` dispatch, which is the analysis itself and has to
happen before the choice.

Then present, per package: current → target, minor/patch or major, and for majors
what `qoq-bumper` found — the breaking changes that actually land here, with the
files they land in. That's the material for a decision.

The user **picks and excludes**. Only then are patches written, for the chosen
set. Writing every patch up front materialises diffs for bumps that are about to
be rejected, and frames the question as yes/no on a finished artifact when the
real question is _which of these_. An empty selection is a valid answer and ends
the run.

## Validation is all three, after every patch

```
qoq fix           →  green
test (full suite) →  green
build             →  green
```

`test` and `build` come straight off the record; `qoq fix` is the command, loop
and all. In that order, cheapest signal first, so a formatting-level break
doesn't cost a full suite run.

No per-patch reasoning about which checks are safe to skip for this kind of
dependency. A dependency bump can break anything — the command exists because you
can't predict what — and a narrowed check that passes tells you nothing about
attribution, it just surfaces the breakage three patches later against a tree
where four things changed.

## Then `refactor`, after the patch lands

Validation says a patch didn't break anything. It doesn't say the migration code
is any good — and migration code is exactly where the rushed adapter and the
copy-pasted shim show up. So each patch that validates green gets one:

```
qoq refactor --decisions auto <this patch's changed files>
```

**After apply-and-validate, not before.** The assessments then read real files in
a real tree, against the version actually installed. Judging an unapplied diff
means patch _N_ assessed without patch _N−1_ in place, findings written against
code that hasn't landed, and a rewritten patch that has to be re-validated
anyway.

`--decisions auto` because a bump is a loop, not a conversation: the mechanical
tier is applied, anything shape-changing comes back as an advisory attached to
that package. A ten-patch bump asks once, at the plan, and never again.

The cost is a second validation pass — test and build only, since the refactor's
own re-green already ran `fix` — on any patch the refactor actually touched.
Patches it leaves alone, which is most version-string bumps, skip it entirely.

Changed files only, not the containing modules. Widening makes every bump's
refactor read a directory to catch a case that hasn't happened yet.

## A failing patch splits before it's abandoned

The grouped minor/patch patch is where attribution goes soft: fifteen packages in
one diff, one breaks the suite, and reverting throws away the fourteen that were
fine. A failure is the signal to cut finer and try again.

| Level | The patch                         | On failure                                             |
| ----- | --------------------------------- | ------------------------------------------------------ |
| 1     | everything minor + patch, grouped | split into **minor** and **patch**                     |
| 2     | one patch per bump kind           | split into **one patch per package**                   |
| 3     | a single package                  | revert, hand to `qoq-bumper`, queue for the next round |

Each level reverts, re-cuts, and re-applies from the top — re-refactored and
re-validated like any other patch, because at levels 2 and 3 they _are_ other
patches. The tree is back to its last-green state before each attempt, so no
level inherits the previous one's damage.

**Splitting minor before patch, rather than bisecting**, is deliberate: it's the
axis that correlates with breakage. Patch releases rarely break anything, so one
split usually lands the whole patch group green in one go and leaves a much
smaller minor group to take apart.

**Level 3 is where the ladder stops.** One package, one version, still failing —
that's not a grouping problem, it's a migration, which is what `qoq-bumper`
exists to read. A package that has _already_ been through the agent and still
fails is carried as unbumpable with the failure named; re-reading the same
changelog to get the same answer is a loop, not a retry.

Re-cutting never needs re-approval. It changes how the approved bumps are sliced,
not which ones were approved. The cost is many more validate cycles than one
grouped patch, which is the trade: the alternative is skipping fourteen good
bumps because a fifteenth was bad.

## One major step per package, per round

A round moves each package **at most one major**. A package two majors behind
gets planned to the next one only; when that lands green, the whole thing loops —
re-plan, re-dispatch `qoq-bumper` against the _new_ current version, and **ask
for approval again**.

Analysing v3 → v5 in one go asks the agent to reason about a migration from a
starting point that doesn't exist yet, and asks the user to choose on evidence
that doesn't apply. Two majors is two decisions, and approval is never inherited
from the previous round — a `bump` that quietly telescoped v3 → v5 is exactly the
unattributable breakage this command exists to prevent.
