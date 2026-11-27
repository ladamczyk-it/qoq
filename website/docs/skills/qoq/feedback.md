---
sidebar_position: 14
title: feedback
description: Sends what you think of a command or agent to the qoq maintainers — a target, a category and optional text, rewritten to name nothing from your project.
---

# `feedback` — what you think, sent to the people who can fix it

Feedback reaches the qoq maintainers two ways: you ask to give it with `/qoq feedback`, or the skill asks once a run is over. People rarely volunteer praise; they speak up when something didn't work, and that's the signal worth keeping. Either way it is one record: a **target**, a **category** and optional **text**.

Answering is the consent — typing `/qoq feedback`, or answering the end-of-run question, which says where the answer goes. No `learning` flag is read, and nothing is asked before the questions below. Like `review`, it skips discovery.

## Asking

Everything is asked as a dialog, never as a question in prose, so most feedback needs no typing: you answer with a number, and the built-in "Other" box is where free text goes.

**Target** — `/qoq feedback <target>` names it: a command (`plan`), an agent (`qoq-developer`), or `qoq` for the skill as a whole. Omitted, it asks which, offering the command that ran last in the session first, then `qoq`.

**Category** — one question, _What went wrong?_

| Option                 | Category               |
| ---------------------- | ---------------------- |
| Wrong result           | `wrong-result`         |
| Ignored what I asked   | `ignored-instructions` |
| Did too much           | `too-much`             |
| Too slow or too costly | `too-costly`           |
| Other, with your text  | `other`                |

An answer typed into "Other" or added as a note becomes the **text**, whatever the category.

## The text, before it's sent

The text is rewritten so it names no path, file, identifier, package, project or line of code — "the hook in `src/rate.ts` was rewritten" becomes "it rewrote a file outside the ticket" — keeping what you meant, including how strongly you put it. When there's text, one last question shows the exact wording under _This goes to the qoq maintainers:_, with **Send** and **Don't send**. With no text there's nothing to preview.

`scripts/learn.mjs` sends it, and refuses what it still detects as project detail (exit `3`), in which case the skill rewrites and retries without asking you. Afterwards you get one line: `sent`, or `unreachable` — an outage, not your problem.

## At the end of a run

Once a top-level run has finished its last line of output, `learn.mjs --due` decides whether to ask. A run that ended badly — a `FAIL`, a `blocked` ticket, or a stop you didn't choose — is due every time, because that's when an answer is worth most; otherwise it is due once a week per machine.

When due, one question: _Did `/qoq <command>` do what you needed? Your answer goes to the qoq maintainers; Skip sends nothing._ — **Yes**, **No** or **Skip**. The second sentence is deliberate: unlike `/qoq feedback`, nobody here chose to give feedback, so the question itself is the disclosure.

- **Yes** sends the command with the category `satisfied`, no text and no preview.
- **No** asks the category question above, with the target already known, then the text step.
- **Skip** sends nothing.

It is never asked after an inner command, after `--decisions auto`, in a run of a plan with a `Feature` header line, or after `feedback` itself — nobody is there to answer the first three, and the last just asked.
