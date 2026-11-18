# `/qoq-fullstack execute` — approved repo plans in, a delivered program out

Read [SKILL.md](../SKILL.md)'s entry, state, session and setup rules first. This
file assumes them.

**Open with one line:** _This run only coordinates. The decisions are made in
each repo's own Opus session, so a cheaper model is enough here, and we
recommend Haiku (`/model haiku`)._ Say it once and carry on. The model is
the user's choice.

Run the setup from SKILL.md, then loop:

1. **Status.** Run the script.
2. **Wake each repo that has work**, out of the repos in the **Repo plans** table.
   A repo the BRD doesn't list is outside this run: skip it. `after` orders
   planning only, never execution, so it never makes a repo wait. A repo whose `next.runnable` is true and
   whose session is idle or gone gets `/qoq execute <planDir>`. A resumed
   execute reconciles an `in-progress` ticket against `git log` on its own
   (`qoq`'s execute reference), so restarting a dead session is always safe.
3. **Integration.** For every master milestone with `integrationDue`, run each
   of its checks, `npm run <script>` in that check's repo, after every repo's
   working tree is clean. Pass → set the master row `delivered <YYYY-MM-DD>`
   in the BRD. That write is the only thing that unblocks the next master
   milestone. Fail → ask the user, giving the failure verbatim and which
   repo should take it. The fix goes back to that repo as a
   `qoq replan` that adds a milestone serving the same master milestone.
4. **Wait** for the next message or idle notice, then go back to 1.

**A repo in trouble.** When a repo relays an escalation or a top-rung
`blocked`, ask the user. Only the repos whose `waitingOn` names that repo's
milestone are stuck, and the other repos keep running. Say which repos are
waiting on it.

**Done.** Every master milestone is delivered → set `Program status: complete`.
Then give one line per repo: its branch, and each delivered milestone's
**Gate evidence**, read from the repo's milestone file.
