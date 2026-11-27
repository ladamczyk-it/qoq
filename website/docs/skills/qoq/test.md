---
sidebar_position: 7
title: test
description: Unit and integration coverage on Vitest or Jest for code that already exists — sliced, written by qoq-tester, gated with fix, tidied with refactor.
---

# `test` — coverage for code that already exists

Unit and integration tests on Vitest or Jest. The record's `runner` field already says which of the two this project is, and a project with neither never got past discovery — so there's no detection phase here.

**One caller: a person asking for coverage over code that already exists.** That's what keeps this command to a single success condition — green, gated, tidy. A ticket's own assertions are not its work: [`execute`](./execute.md)'s `qoq-developer` raises them to the conventions itself, in the thread that wrote the implementation — it can't dispatch a subagent anyway, and a ticket arrives pre-sliced, which is the one thing this command's slicing exists to do.

Browser-driving suites are a different discipline whose conventions don't transfer; if one ever needs a command, it's a different command.

```mermaid
flowchart TD
    TARG["a path, or a behaviour to cover<br/><i>(one caller: a person asking for<br/>coverage over code that exists)</i>"]
    TARG --> TD1
    TD1["<b>read the record</b> — runner · globals ·<br/>React? · conventions file · commands.<br/><i>nothing rediscovered here</i>"]
    TD1 --> TTDD{"<b>tdd</b> in the<br/>available-skills list?"}
    TTDD -->|"no — no proceed-without"| TTSTOP(["<b>stop</b> — install mattpocock-skills,<br/>then run again"])
    TTDD -->|yes| TSCOPE["<b>agree the seams</b> — propose what to test,<br/>unit or integration, what each catches<br/>and misses. wait for the answer"]

    TSCOPE --> TBASE["<b>run the full suite</b> —<br/>is the base green?"]
    TBASE -->|"red"| TBASK(["<b>ASK THE USER</b> — pre-existing failures:<br/>skip them, or fix them first?"])
    TBASK -.->|"fix first"| TOLD["dispatch <b>qoq-tester</b><br/>over the failing specs"]
    TOLD --> TBASE
    TBASK -.->|"skip — recorded as the baseline"| TSLICE
    TBASE -->|"green"| TSLICE

    TSLICE["<b>slice the scope</b> — one coherent unit<br/>each: a file, a component, a behaviour"]
    TSLICE --> TDISP["dispatch <b>qoq-tester</b><br/>(Sonnet, <b>one slice at a time</b>)<br/>hands it: conventions · commands ·<br/>the slice + agreed seams · the baseline"]

    subgraph TESTER["qoq-tester flow <i>(everything the agent does)</i>"]
        direction TB
        A1["write the specs<br/>for this slice"]
        A1 --> A2["run `test:one` on exactly those specs —<br/><i>the project's own script,<br/>never the qoq CLI</i>"]
        A2 -->|"red"| A4
        A2 -->|"green"| A3["<b>the full suite</b> —<br/>against the baseline it was given.<br/><i>a scoped run can't see a shared<br/>setup file or a global mock break</i>"]
        A3 -->|"green"| ASTG["<b>npx qoq staged</b> over those specs —<br/><i>seconds, and it spares a gate<br/>round on a lint finding</i>"]
        A3 -->|"red"| A4{"3 rewrites<br/>spent?"}
        A4 -->|"no — rewrite, don't patch"| A1
        A4 -->|"yes"| AHAND(["<b>hands back</b> — what it tried,<br/>the blocker verbatim, what's on disk.<br/><i>a subagent can't ask</i>"])
        ASTG --> ARET["return: <b>the files written</b>,<br/>what the suite says"]
    end

    TDISP --> A1
    AHAND --> TNARROW(["<b>ASK THE USER</b> — narrow this slice?<br/>fewer cases, one behaviour at a time —<br/>with the agent's blocker, quoted"])
    TNARROW -.->|"narrowed — counter resets"| TDISP
    TNARROW -.->|"no"| TSTOP2(["<b>stop</b> — report the blocker,<br/>nothing half-written left behind"])

    ARET --> TGATE["<b>qoq fix</b>, scoped to<br/>the files it returned —<br/><i>the gate, run from here</i>"]
    TGATE -->|FAIL| A4
    TGATE -->|"PASS, and fix changed files"| TRERUN["re-run the full suite —<br/>fix's own check is scoped"]
    TRERUN --> TMORE
    TGATE -->|"PASS, nothing changed"| TMORE{"slices<br/>left?"}
    TMORE -->|"yes — on the tree<br/>this one left green"| TDISP
    TMORE -->|"no"| TREF["<b>qoq refactor</b><br/>scope = every file written"]
    TREF --> TDONE(["<b>done</b> — tests green,<br/>gated, tidied. never .skip,<br/>never a loosened assertion"])

    classDef agent fill:#8b5cf61f,stroke:#8b5cf6,stroke-width:2px
    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px
    classDef skill fill:#ef44441f,stroke:#ef4444,stroke-width:2px

    class TESTER agent
    class TNARROW,TBASK user
    class TGATE,TREF skill
```

## `tdd` first

Every spec this command writes sits on `tdd`. Before the seams are proposed: is it in the session's available-skills list, under any name? Not there → the run **stops**, even if its files are on disk: a disabled plugin stays in the cache, and the list is the only thing that knows it's off. `qoq-tester` lists `tdd` in its `skills:` frontmatter, so Claude Code preloads it — but an unresolved entry starts the agent without it, silently, so the check can't be skipped. A tester dispatched as `general-purpose` is told to invoke `tdd` with the Skill tool first.

**`tdd` isn't invoked on this thread**: loaded here, its red → green loop would pull the orchestrator into writing the specs itself, and the tester, the gate and the refactor would never run. The stop has no proceed-without — `tdd` normally arrives with qoq as a plugin dependency; install it with `/plugin install mattpocock-skills`, then run `test` again.

## Seams are agreed before anything is written

`tdd` writes no test at an unconfirmed seam. The public interfaces the scope exposes are worked out, and the **seams to test** are proposed — one line each on what it catches and what it misses, and whether it's a unit seam (one piece in isolation) or an integration seam (a flow across pieces) — then you answer. It's the one question asked before the baseline run, and it decides where the testing effort lands.

## The baseline run

The full suite runs **before anything is written**. A run afterwards can only tell you "something is red", not "_your_ file made it red" — and without that, a project with three pre-existing failures either blocks a command that did nothing wrong, or learns to shrug at real breakage.

A red base is a question, not a stop, and the two answers are genuinely different jobs:

- **Skip** records the failing specs as the baseline. They're excluded from the post-write judgement and reported at the end, untouched.
- **Fix first** is work this command is qualified to do — they're test files, its own material. They're rewritten under the same three-rewrite budget, then the base is re-checked.

What it never does is quietly absorb them into the new work's result. (Unlike [`refactor`](./refactor.md), which stops dead on a red base — the failing thing there isn't its own material.)

## Slices, one at a time

The scope is cut into coherent units — a file, a component, a behaviour — and `qoq-tester` is dispatched once per slice, sequentially. Each slice ends with a full suite run whose whole purpose is attribution; if two agents are writing while it runs, a red result names neither of them. Sequential also means each slice starts from the tree the previous one left green.

N slices is N full-suite runs — that cost is the design, not an oversight. Every dispatch carries the record's path, the paths to the skill's test and code conventions, the slice stated as narrowly as it can be stated, the baseline of already-red specs, and any specs already in place for this slice — a ticket's own hand-written assertions get rewritten to standard, not duplicated by a second file asserting the same thing.

`qoq-tester` writes tests and **only** tests: a spec that fails because the code under test is broken is a finding it reports, never a licence to edit production source.

## Two checks per slice, one refactor at the end

1. **The tester's own proof, before it hands back.** `test:one` on the specs it wrote — they have to run and pass — then the full suite against the baseline it was given, because a scoped run can't tell you a new spec broke someone else's through a shared setup file or a global mock. Then `npx qoq staged` over those specs, which costs seconds and spares a gate round on a lint finding.
2. **[`fix`](./fix.md) from here, scoped to exactly those spec files.** This is the gate. It runs **last** rather than first, which inverts the obvious order for a reason: `fix` rewrites files — Prettier reformats, ESLint autofixes — so it has to be the thing that verifies its own rewrites, and it does, by re-running `test:one` on every file it touches and reverting any fix that goes red. A check placed before it would be validating a version about to change. If `fix` changed anything, the full suite is re-run before the next slice.

**`refactor` runs once, after the last slice**, scoped to every file written. Green and gated is not the same as good, and test files are where near-duplicate arrange blocks and copy-pasted setup pile up fastest — nothing in `fix` has an opinion about that. Once rather than per slice, because duplication _between_ specs is most of what there is to find, and that isn't visible until they all exist.

## A red result rewrites, it doesn't patch

When a slice comes back red the spec is **rewritten against what the run actually reported**, not amended in place. A spec patched to get past one assertion accumulates scaffolding that has nothing to do with the behaviour under test, and each amendment is judged against a file the previous amendment already reshaped. A gate `FAIL` lands in the same place for the same reason.

**Three rewrites, then the agent hands back and you're asked.** Running out isn't a report-and-stop; it's a question — three attempts at one slice that all end red usually means the slice was too wide to write in one go, and the smallest useful thing to ask for is fewer cases or one behaviour at a time. The agent returns `status: handoff` and you're asked with its `blocker` quoted verbatim. A narrowed slice resets the counter; a no ends the run with the blocker reported and the handoff's `files` removed — nothing half-written left behind.

## Conventions

`tdd` is the base — what a good test is, seams, mocking, the anti-patterns. The skill's own `test-conventions.md` is the house rulebook on top of it, and wins where the two conflict — React Testing Library and MSW conventions, and the lint rules that make a spec clean by construction (no `.only`/`.skip`, unique titles, at least one assertion per test, no conditionally-registered tests). It's readable on its own, so whoever writes a test in the project should read it rather than reinvent a style.

The project's own conventions file, named on the record's `conventions` field, **wins over both** — it's human-written and knows things the skill can't infer.
