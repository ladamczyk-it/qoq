---
sidebar_position: 10
title: mermaid
description: qoq-artist turns a flow, lifecycle, data model or architecture into a Mermaid chart validated to parse — printed, written into a doc, or drawn into plans and milestone docs.
---

# `mermaid` — the shape, at a glance

`qoq-artist` turns structure that prose handles badly into a Mermaid chart, **validated to parse before it lands**, so it renders on GitHub. It decides whether a chart earns its place at all, and a reasoned decline is a valid answer.

## Standalone — `/qoq mermaid <description>`

```text
/qoq mermaid login with retry and lockout                    # print it
/qoq mermaid login with retry and lockout --to docs/auth.md  # create, or append
/qoq mermaid login with retry and lockout --to docs/auth.md#lockout
```

Ungated: typing it is the opt-in. The positional argument is a description, not a path.

- **No `--to`** prints the chart.
- **`--to <path>`** writes it to that file, created if absent.
- **`--to <path>#<slug>`** puts it at the end of that heading's section, by GitHub's anchor slug. A slug the file doesn't have is a one-line stop that lists the ones it does — never a guess, never a new heading.

A question from the artist comes back to you, and the answer goes back verbatim. A written file gets `npx qoq prettier --fix`; then the result is shown — where, which chart type, why, `unvalidated` if it is — and nothing is committed.

A rerun with the same `--to path#slug` replaces that section's chart. Without a slug it matches only a chart with the same id — the description's kebab — so a different description appends a second one.

## In the pipeline — off unless switched on

**Experimental, so opt-in:** the `plan`, `replan` and `execute` call sites run only with `--diagrams`, or when `qoq.config.*` sets `future: { unstable_skill_diagrams: true }`. It's decided once at the start of the run and stated in its opening line.

### `plan` and `replan` — before approval

After the self-review, before the plan is shown, the artist charts the drafted plan into its `## Diagrams` section, so you approve the shape as well as the text. Questions are asked right away — approval is interactive anyway. At approval you're told what it drew and declined, one line each; declines are never written into the plan.

**You hold a veto.** "Drop it" deletes the chart, and an emptied `## Diagrams` goes too. "It's wrong" resumes the artist with your correction verbatim.

The plan's charts record the shape that was **approved**. Nothing redraws them during `execute` — the docs charts record what was delivered, and the gap between the two is information. Only `replan` redraws them, and only for the live part; charts of frozen milestones stay as approved.

### `execute` — after the scribe

In the milestone gate, after [`document`](./document.md#plan-mode--from-executes-milestone-gate)'s scribe and before Prettier, when **both** docs and diagrams are on. The scribe's report is the artist's input, so diagrams without docs is inactive: the opening line says `diagrams: on, inactive — needs --docs` and the run carries on.

The artist draws the scribe's candidates, and updates its own existing charts in the files the scribe touched. Its changes join the same `docs(m<N>)` commit. A question becomes `diagrams skipped: <question>` in the milestone's **Docs advisories**, and an `unvalidated` chart or a stale hand-drawn one adds a line there too.

### `/qoq document` — offered, never run

Standalone `document` doesn't dispatch the artist. When the scribe found candidates, the run ends on an offer to draw them; on a yes they're drawn exactly as in `execute`, and left uncommitted.
