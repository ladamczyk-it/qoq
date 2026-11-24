---
sidebar_position: 11
title: sheriff
description: Always on in execute — qoq-sheriff sweeps a change for logic-level security problems a linter can't see, standalone over paths, a range or a pull request, or after every milestone.
---

# `sheriff` — is this change introducing anything fishy?

The mechanical layer is already covered: `qoq fix` runs ESLint — sonarjs included — and `qoq scan` owns dependency vulnerabilities. What neither sees is logic: a query built from a request field three calls away, a route that authenticates but never authorizes, an endpoint in one ticket that is only dangerous because another ticket dropped the check in front of it. `qoq-sheriff` reads for exactly that and returns typed findings. **The analysis is delegated; every decision — asking, accepting, remediating — stays on the main thread**, because the agent can't stop to ask.

```text
/qoq sheriff                                       # files changed since the merge-base with the default branch
/qoq sheriff src/auth 'src/**/*.ts'                # snapshot: those paths, as they stand
/qoq sheriff main..HEAD                            # diff: that range, no plan
/qoq sheriff https://github.com/acme/api/pull/123  # pr: that pull request, against its description
```

Scope is positional. A `https://…/pull/<n>` link is a pull request, an argument containing `..` is a range, and anything else is a path or a glob. A bare number is not a pull request: it stops with one line asking for the link. The default is `git diff --name-only` against the merge-base with the default branch, swept as a snapshot; an empty default scope is a one-line stop.

## The agent

`qoq-sheriff` has no `model:` line on purpose: it runs at the **session's** model, always cold, because the author's model and context share the author's blind spots and a cheaper pinned tier would quietly win. It reads the project before judging it — framework, where requests enter, how it authenticates and authorizes, which helpers it trusts — plus `docs/adr/` and `GLOSSARY.md` when the project has them. An ADR is a decision a person recorded, and it settles intent the same way a `Security context` line does: a finding it answers isn't `ambiguous` and isn't asked about, and an ADR whose premise the change breaks is itself a finding, with the ADR quoted. The glossary says what the project's own words for ownership and roles mean, which is what an authorization check is measured against. It looks for injection, broken authentication or authorization, unsafe input at a trust boundary, secrets, unsafe deserialization, data exposure and moved trust boundaries. Then it reads the change **as one piece**, listing what each part changed at a trust boundary and looking for pairs: a finding that exists only because two tickets met gets one finding with both locations.

What is not its job: anything an **enabled ESLint rule** already flags (it reads the resolved config, never runs ESLint, and lists the pattern in `skipped_covered` with the rule name), vulnerable dependencies, and design or scope questions.

**Every secret is redacted.** The report is copied into a committed plan, a remediation ticket and, in `pr` mode, a comment posted under your name, so a quoted credential would leak again in each. Wherever a secret value would appear — `anchor`, `reason`, `evidence`, `exploit`, prose — the agent writes `<REDACTED>` and keeps the rest of the line, so `const apiKey = '<REDACTED>';` still finds its spot on a recheck. It names the kind of secret and where it is, never the value or a prefix of it.

Every finding carries a severity (`critical` → `low`), a location with a verbatim anchor line, and **a concrete exploit** — "could be vulnerable if" with no path to it is not a finding. **Confidence is about intent, not certainty**: `confirmed` means the code does the thing and nothing it was given says it should; `ambiguous` means it might be intended, and carries a yes/no `question`. The agent never decides intent, and an ambiguous finding stays ambiguous at any severity. When the repo can't answer something a finding turns on, it writes no report and returns `status: question`. It never edits.

A location carrying `qoq-sheriff: accepted — <reason>` was looked at by a person and is skipped — unless the change touches the marked block, or another finding breaks the reason the marker states, in which case it comes back as an `ambiguous` finding asking whether the acceptance still stands.

## Standalone

Ungated: typing it is the opt-in.

**Paths, globs and ranges** run locally: `qoq-sheriff` is dispatched in `snapshot` or `diff` mode, and the report is printed with a note that **intent was not judged** — with no plan it can say what the code does, not whether anyone meant it. Nothing is written to disk. Remediation is offered, not started; on a yes each finding goes through the routing and loop below, after a branch check (on the default branch, it asks and suggests `sheriff/<topic>`), with `qoq fix` plus the full build and suite as the re-gate.

**A pull request link** follows [`review`'s pull request flow](./review.md#pull-requests) step for step: the PR may belong to any repository and is read from a scratch clone, the output is proposed inline comments for you to pick, posted as one `COMMENT` review under your name — and there is no remediation. The sheriff's review and `qoq review`'s are separate runs that post separate reviews.

## Pipeline — from `execute`

**Always on, with no switch:** [`execute`](./execute.md) sweeps every milestone and every `Security sweep: ticket`, and [`plan`](./plan.md) always proposes `Security sweep: ticket` for tickets that touch authentication or authorization, parse outside input or handle a secret — you confirm each at approval. The earlier `--sheriff` flag and `future.unstable_skill_sheriff` switch are gone.

There is no skip rule: it sweeps every milestone, spec-only ones included.

- **The milestone sweep** runs after the milestone gate is green and before `document`, so it sees what will actually ship. It gets the milestone's range over `done` tickets, the union of their files, the Goal, Contracts and criteria, and the plan's `**Security context:**` line. A `status: question` **stops the run** — the next milestone would build on code nobody swept — and your answer becomes the `**Security context:**` header line, so it is never asked twice.
- **The per-ticket sweep**: a ticket marked `Security sweep: ticket` also gets an early sweep after Gate 2 and before its commit. Auto-routed findings go back to the same developer and spend that ticket's delivery attempts. The milestone sweep still covers the whole diff.

### Routing

| Finding                            | Goes to                                                |
| ---------------------------------- | ------------------------------------------------------ |
| `confirmed` + `critical` or `high` | remediation, now — no question                         |
| `ambiguous` + `critical` or `high` | **you, now** — the run stops at this gate              |
| anything `medium` or `low`         | a **Security advisory** — walked through at end of run |

For any finding put to you: **remediate**; **accept** (a `qoq-sheriff: accepted — <your reason>` comment above the first location, committed alone as `chore(m<N>): accept security risk S<n>` — a file with no comment syntax is recorded as defer instead); or **defer** (a ticket in the next milestone, or a new final "Security follow-ups" milestone).

### Remediation

A security fix is a new, narrow job, not a loop back into a delivered ticket, and **its budget is two rounds**, counted apart from any ticket's three delivery attempts. One round: a `Ticket <N>.S<k>` per finding (the exploit restated as an assertion that must now fail, or a static assertion where no runtime exploit exists), a `qoq-developer` dispatch at `sonnet`, a scope check by file, Gate 1 and 2, a commit `fix(m<N>): security S1,S2`, a re-gate (`qoq fix` over the union with Knip on, plus the full build and suite — not `refactor`, whose auto tier could reshape the fix), then a `qoq-sheriff` recheck marking each finding `resolved` or `surviving`. Two rounds spent with findings surviving → you get each finding, both diffs and both rechecks, with four options: one more round, accept, defer, or stop the run.

### What gets recorded

The milestone's Outcome block gains a **Security** line — the verdict, then one entry per finding with how it ended — and **Gate evidence** gets the sweep's one-line verdict. At the end of the run you are walked through every milestone's Security advisories once; a remediate answer then runs the loop on an already-delivered milestone and updates its Security line in the Outcome block.
