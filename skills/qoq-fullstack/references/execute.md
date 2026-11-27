# `/qoq-fullstack execute` — approved repo plans in, a delivered feature out

Read [SKILL.md](../SKILL.md)'s entry, state, session and setup rules first. This
file assumes them.

**Open with one line:** _This run only coordinates. The decisions are made in
each repo's own Opus session, so a cheaper model is enough here, and we
recommend Haiku (`/model haiku`)._ Say it once and carry on. The model is
the user's choice.

Run the setup from SKILL.md, then loop:

1. **Status.** Run the script. If a spending limit is armed, run its check
   too, before anything below is woken or sent ([below](#spending-limits)).
2. **Wake each repo that has work**, out of the repos in the **Repo plans** table.
   A repo the BRD doesn't list is outside this run: skip it. `after` orders
   planning only, never execution, so it never makes a repo wait. A repo whose `next.runnable` is true and
   whose session is idle or gone gets `/qoq execute <planDir>`, plus the
   run's limit flags while the limit is armed. Don't ask
   first. The user approved that plan and ran `execute`, so a question here
   just stalls every runnable repo. A resumed
   execute reconciles an `in-progress` ticket against `git log` on its own
   (`qoq`'s execute reference), so restarting a dead session is always safe.
3. **Integration.** For every master milestone with `integrationDue`, run each
   of its checks, `npm run <script>` in that check's repo, after every repo's
   working tree is clean. Pass → set the master row `delivered <YYYY-MM-DD>`
   in the BRD. That write is the only thing that unblocks the next master
   milestone. Fail → ask the user, giving the failure verbatim and which
   repo should take it. The fix goes back to that repo as a
   `qoq replan` that adds a milestone serving the same master milestone.
4. **Wait** for the next message or idle notice, then go back to 1. Before
   waiting, start one background `sleep 1800` (`run_in_background`) unless one
   is already running. It's the heartbeat for a session that hangs or dies
   without an idle notice. When it fires, a repo that ListAgents still lists as
   busy, whose plan files and `git log -1` haven't moved, and which hasn't
   messaged since the last heartbeat, gets one status `SendMessage`: a request
   for a one-line status, never a `/qoq` invocation, since a busy session would
   queue a second run behind the one it's in. Still silent at the next
   heartbeat → ask the user, naming the repo. Never restart
   a busy session yourself: it would become a second writer in that checkout.
   A session that's gone is step 2's to restart.

**A repo in trouble.** When a repo relays an escalation or a top-rung
`blocked`, ask the user. Only the repos whose `waitingOn` names that repo's
milestone are stuck, and the other repos keep running. Say which repos are
waiting on it.

**Done.** Every master milestone is delivered → set `Feature status: complete`.
Then give one line per repo: its branch, and each delivered milestone's
**Gate evidence**, read from the repo's milestone file.

## Spending limits

`--session-limit <pct>` and `--weekly-limit <pct>` mean what they mean in
`qoq`'s execute reference, which owns them. Either flag arms the limit, and a
flag left out defaults to 100. Neither given → no limit, no check, and no flags
forwarded. The limits are for the whole account, so this thread and every repo
session draw on the same number. They last for this run only: a later
`/qoq-fullstack execute` without them has no limit, and nothing is written to
the BRD or `feature.json`.

**Your own check.** At the start of every loop round, before you wake or
instruct anyone, run:

```bash
node ${CLAUDE_SKILL_DIR}/../qoq/scripts/usage-check.mjs --session-limit <pct> --weekly-limit <pct>
```

Pass both, always: the user's number for each flag they gave, and 100 for
the one they left out. Show its stdout verbatim. Exit 0 → carry on. Stdout
starting `usage unavailable` → say so in one line and carry on. Exit 1 → the
question below.

**The repos' checks.** Every `/qoq execute` you send carries
`--session-limit <pct> --weekly-limit <pct>`, so each repo also checks before
every ticket, which is how a milestone already under way stops.

**One question for the whole run.** Your own check and the repos reach the
limit at nearly the same time, so the same "carry on anyway?" question would
arrive N times. Ask the user once, whichever arrives first, and say in the
question that the answer applies to every repo and to this thread for the rest
of the run. Then:

- Any repo that asks afterwards gets the user's answer, quoted as theirs. That
  passes the user's decision on. It isn't one made here.
- **Yes** → the limit is off: no more checks of your own, and later wakes and
  restarts send `/qoq execute <planDir>` without the flags.
- **No** → wake nothing new and run no integration check. The repos stop
  cleanly, as `qoq` does. Leave `Feature status` at `in-progress` and end
  with: _Limit reached. Resume with `/qoq-fullstack execute <slug>
--session-limit <pct> --weekly-limit <pct>` once the window rolls over._
