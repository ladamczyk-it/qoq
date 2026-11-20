# `qoq feedback` — what the user thinks, sent to the people who can fix it

Feedback reaches the learning sink two ways: the user asks to give it, or the
skill asks once a run is over. People rarely volunteer praise. They speak up
when something didn't work, and that's the signal worth keeping. Either way it
is one record: a **target**, a **category**, and optional **text**.

Typing feedback is the consent. No `learning` flag is read, and nothing is asked
before the questions below.

## Asking: always the dialog

Ask everything with AskUserQuestion, never as a question in prose. The dialog
lets the user answer with a number, and its built-in "Other" box is where free
text goes. Most feedback then needs no typing at all.

**Target**: `/qoq feedback <target>` names it: a command (`plan`), an agent
(`qoq-developer`), or `qoq` for the skill as a whole. Omitted, ask which, offering
the command that ran last in this session first, then `qoq`.

**Category**: one question, _What went wrong?_

| Option                 | Category               |
| ---------------------- | ---------------------- |
| Wrong result           | `wrong-result`         |
| Ignored what I asked   | `ignored-instructions` |
| Did too much           | `too-much`             |
| Too slow or too costly | `too-costly`           |
| Other, with their text | `other`                |

An answer typed into "Other" or added as a note becomes the **text**, whatever
the category.

## The text, before it's sent

Rewrite it so it names no path, file, identifier, package, project or line of
code. "the hook in `src/rate.ts` was rewritten" becomes "it rewrote a file
outside the ticket". Keep what the user meant, including how strongly they put
it.

When there's text, show it in one last question: _This goes to the qoq
maintainers:_ followed by the exact text, with **Send** and **Don't send**. With
no text there's nothing to preview. Send it as it is.

```bash
node <skill>/scripts/learn.mjs --kind feedback --target <target> \
  --category <category> [--text "<rewritten text>"]
```

Exit 3 means the script still found project detail. Rewrite and try again;
don't ask the user to. Then tell them in one line what happened: `sent`, or
`unreachable`. That's an outage, not their problem.

## At the end of a run

Once a top-level run has finished its last line of output, before going idle:

```bash
node <skill>/scripts/learn.mjs --due [--ended-badly]
```

Pass `--ended-badly` when the run ended on a FAIL, a `blocked` ticket, or a stop
the user didn't choose. That's when an answer is worth most, so it's due every
time. Otherwise it's due once a week per machine. Exit 1 → say nothing.

Exit 0 → one question: _Did `/qoq <command>` do what you needed?_ **Yes** ·
**No** · **Skip**.

- **Yes** → send `--target <command> --category satisfied`, no text, no preview.
- **No** → the category question above, with the target already known, then the
  text step.
- **Skip** → nothing.

Never after an inner command, after `--decisions auto`, or after `feedback`
itself. Nobody is there to answer the first two, and the last just asked.
