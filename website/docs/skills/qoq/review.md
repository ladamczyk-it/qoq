---
sidebar_position: 12
title: review
description: Experimental in execute — qoq-reviewer judges, on a Spec and a Standards axis, a delivery against the plan that asked for it, or a pull request against its description, for wrong turns the gates can't see.
---

# `review` — does this delivery make sense against the plan?

Every ticket passed its gates, the test reviewer approved its specs and the [sheriff](./sheriff.md) swept the milestone — and none of them reads the delivery as a whole against what was asked. A ticket returning `null` where a later caller expects a throw, a criterion satisfied by a special case instead of the behaviour it describes, a helper nobody asked for. `qoq-reviewer` is that read on **two axes** — **Spec** (against the intent behind the change) and **Standards** (against the project's conventions) — and returns typed findings. **The analysis is delegated; asking, accepting and remediating stay on the main thread.**

```text
/qoq review https://github.com/acme/api/pull/123
```

Standalone, it takes **a pull request link and nothing else**: it judges a diff against the intent behind it, and a path snapshot has no intent. A bare number, a path or no argument stops with one line asking for the link.

## The base — `code-review`

The command is built on mattpocock-skills' `code-review`, resolved from the available-skills list before the first dispatch and invoked once per run. (Claude Code ships a built-in `code-review` too, so it's matched on its description — two axes, Standards and Spec — and a bare name and a `mattpocock-skills:` one don't resolve interchangeably.) Its process is the frame: two isolated axes, each a cold subagent, issued together, then reported side by side and never reranked. **The qoq reference wins where they conflict**: the range is always given (a PR's base...head, or a milestone's first..last), the spec source is the plan or the PR's description and closed issues, and the standards sources are only the record's `conventions` file and the skill's code conventions — no repo-wide search for style documents. The base's **smell baseline** is kept and pasted verbatim into every Standards dispatch.

Missing → it asks once, before doing any work: install it (`/plugin install mattpocock-skills`; it normally arrives with qoq as a plugin dependency) or proceed without it — both axes, every gate, no smells, with the skipped base named in the report's summary line. In `execute` it asks at the first milestone review and keeps the answer for the run.

### The report layout

Two sections, `## Spec` then `## Standards`, each listing its findings with severity, confidence, locations, reason and evidence. They're never merged or reranked across each other, because one axis passing must not hide the other failing. The report ends on one line giving the finding count per axis and the worst finding _within_ each. Routing stays global, and that's safe: a Standards finding is never `high`, so only Spec can stop a run.

## The agent

`qoq-reviewer` runs at its pinned model (Sonnet) and always starts cold — a fresh dispatch every time, so it holds none of the author's context and reads the diff as a stranger would — **once per axis**, two dispatches issued together and read-only, so running them in parallel is safe. A change can pass one axis and fail the other, and a reviewer holding both lets the louder one mask the quieter. It learns the project's conventions before it flags anything — a pattern is a finding only against what _this_ repo does. On the **Spec** axis it looks for:

- **Correctness** — a criterion met in letter and missed in intent, a Contract the code doesn't honour; with no intent given, code that contradicts its own names, types or callers
- **Scope** — by traceability: every hunk must trace to a criterion, a Contract or the Goal, or be forced by one. Nothing traces and nothing forces it → `confirmed`
- **Consistency** — the same thing done two ways across tickets
- **Gap** — `plan` mode only: a requirement no milestone delivered

On the **Standards** axis it reads the diff against the record's `conventions` file, the skill's code conventions and the smell baseline: a documented rule the hunk plainly breaks, or what the next change will trip on (**maintainability**, which includes a named baseline smell). Standards findings are `judgment` calls and never `high`, and anything the project's own linters already enforce is skipped.

Each axis raises only its own categories. Security is the sheriff's: something that looks like it goes in `security_noticed`, one line, never in `findings`. Confidence is about intent — `confirmed` or `judgment`, and a `judgment` finding carries a yes/no question and stays `judgment` at any severity, because the agent never decides intent. It has four modes — `milestone`, `plan`, `pr` and `recheck` — and never edits.

## Pull requests

`sheriff` follows this flow to the letter for its own pull request runs. For `review`, step 4 is two dispatches issued together, one per axis (the Spec axis still runs when no intent was stated, judging correctness against the code's own contract), and the drafts in step 5 are grouped by axis.

1. **Resolve it** with `gh pr view` and `gh issue view` for each issue it closes; on failure, stop and quote the error.
2. **Read it from a scratch clone**, never the working directory — the PR may belong to another repository. Reused on later runs; nothing in it is ever committed or pushed.
3. **Decide whether it states intent.** A title, body or closed issue that says what the change should do counts; "fixes stuff" does not. With none, the report says so once, no `scope` or `gap` findings are raised, and `correctness` is judged against the code's own contract only.
4. **Dispatch** in `pr` mode. A `status: question` is asked and re-dispatched with your answer verbatim.
5. **Propose comments**: one inline comment per finding, drafted the way you would write it to a colleague — no finding ids, confidence labels or mention of qoq. A finding with no line in the diff goes into the review body.
6. **You pick** which to post, rewrite or drop; nothing is posted without that answer. The approved ones go out as **one review with event `COMMENT`** — never `APPROVE` or `REQUEST_CHANGES`, which are your verdict to give on GitHub.

Standalone it is ungated and skips discovery. There is no accept and no defer — with no plan there is nowhere to record either — and `security_noticed` lines are listed as "worth a `/qoq sheriff <link>`".

## Pipeline — from `execute`

**Always on.** No flag, no config switch and no skip rule: it reviews every milestone ([`execute`](./execute.md), Setup). The earlier `--review` flag and `future.unstable_skill_review` switch are gone.

### The milestone review

It runs after the sheriff and its remediation, and before `document`, so the reviewers read the diff that will ship. Both axes get the range over `done` tickets, the Goal, Contracts and criteria, the plan's `**Review context:**` line, the milestone's Security line and earlier milestones' Review lines; the Standards axis also gets the refactor gate's advisories (so a smell the gate already raised isn't raised twice), the record's `conventions` path and the smell baseline. A `status: question` on either axis **stops the run**, and your answer becomes the `**Review context:**` header line.

| Finding                    | Goes to                                             |
| -------------------------- | --------------------------------------------------- |
| `confirmed` + `high`       | remediation, now, with no question                  |
| `judgment` + `high`        | **you, now**: the run stops at this gate            |
| anything `medium` or `low` | a **Review advisory**, walked through at end of run |

Your options are **remediate**, **accept** (recorded on the milestone's Review line as `R<n> accepted — <file>:'<anchor>' — "<your reason>"` — nothing is written into the code), or **defer** (a ticket in the next milestone, or a final "Review follow-ups" milestone).

### Remediation

The [sheriff's loop](./sheriff.md#remediation) — a new narrow `Ticket <N>.R<k>`, two rounds of its own, scope check, gates, re-gate without `refactor`, recheck — with these differences: criteria are each finding's `plan_ref` restated as an assertion that must now hold; `correctness` and `consistency` run at the **session** model and `scope`, `standards` and `maintainability` at `sonnet`; a fix needing more than five files, or changing a milestone's Contracts, goes to you with "hand to `qoq replan`" recommended; the commit is `fix(m<N>): review R1,RS2` (Standards findings carry an `RS` prefix, Spec ones `R`); and a `qoq-sheriff` recheck runs over the fix before the reviewer's own recheck, so a maintainability change can't quietly drop a guard. The reviewer's recheck is dispatched once per axis that raised a remediated finding, each getting only its own findings.

The milestone's Outcome block gains a **Review** line, and Gate evidence gets the review's one-line verdict.

### The end-of-plan pass and the sign-off

Once every milestone is delivered or withdrawn and no ticket is `blocked`, `qoq-reviewer` runs once in `plan` mode, on the Spec axis only — each milestone's standards were already read: not a code review, but one question — does what was delivered add up to what the plan set out to do? It maps each requirement to the milestones that delivered it, and a `gap` goes to you with four options: a new final **"Plan gaps"** milestone, hand to `qoq replan`, accept as out of scope, or drop. After a Plan gaps milestone is delivered the pass runs **once more**, so it cannot loop.

Then, in order: the advisory walkthrough (Refactor, Docs, Security and Review advisories), and the **sign-off** rendered on the main thread — a one-line verdict (_delivered_, _delivered with open items_, or _gaps_), the asked-vs-delivered table, open items, gate evidence per milestone, and the question. A yes is written into the plan header as `**Signed off:** <YYYY-MM-DD> — <note>`; a no records nothing.
