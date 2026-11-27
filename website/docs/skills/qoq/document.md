---
sidebar_position: 9
title: document
description: Experimental — qoq-scribe writes down the why behind a scope as JSDoc, ./docs behind a table-of-contents index and the README's Documentation link, standalone or after every delivered milestone.
---

# `document` — write down the why

The code says what it does; `qoq-scribe` writes down **why** — the intent behind it, the tradeoff somebody already settled, the workflow that only makes sense once you see three files at once. It writes JSDoc and short `//` comments in the code, Markdown under `./docs` indexed by a table-of-contents `docs/index.md` (links only, no project description), and the one-link `## Documentation` section that closes `README.md`. It adds comments and never changes behaviour, never flags code for refactoring, and never draws diagrams — that's [`mermaid`](./mermaid.md).

```text
/qoq document                    # files changed since the merge-base with the default branch
/qoq document src/auth src/a.ts  # those paths only
```

Scope is positional, like every other command. The default is `git diff --name-only` against the merge-base with the default branch, and an empty default scope is a one-line stop, not a question. Monorepos get no special handling: one `./docs` and one `## Documentation` at the root.

`./docs` counts as **managed** only when `docs/index.md` starts with `<!-- qoq-scribe index -->` and lists every `.md` in it. Anything else — no index, an index without the marker, or a doc the index doesn't list — is **unmanaged**: the scribe writes nothing and returns a per-doc migration proposal first.

## Path mode — `/qoq document`

Standalone, it needs no switch: typing it is the opt-in.

1. **`qoq-scribe` runs at the session's model**, because path mode is inference on code nobody explained to it. Whatever it can't infer, it marks with `@todo qoq-scribe:` rather than guessing.
2. **A question comes back to you**, and the answer goes back to the scribe verbatim. It wrote nothing, so there's nothing to undo.

   **Unmanaged `./docs` (`status: migrate`)** comes back to you too, one doc at a time: what it covers, the proposal (`convert`, or `convert` / `keep` / `delete` for a doc that describes no code) and every question. A hand-written index's project description is proposed as `move-to-readme` or `drop`. Nothing is picked for you — a hand-written doc deleted or rewritten on a guess is the one loss this command can cause. Your decisions go back verbatim; the scribe regenerates, and from then on `./docs` is agent-owned.

3. **`npx qoq prettier --fix`** reflows the JSDoc and Markdown. Nothing else in a comments-only change can trip a gate.
4. **You're walked through the report**: each marker, then a missing README (create one holding only a title and `## Documentation`?), then any deleted docs. A marker you explain is replaced with your explanation, worded as a comment. Unanswered markers stay.
5. **It stops with the changes uncommitted**, for you to review. When the scribe found something worth a chart, the run ends on an offer to draw it.

## Plan mode — from `execute`'s milestone gate

**Experimental, so opt-in:** it runs only when [`execute`](./execute.md) was given `--docs`, or `qoq.config.*` sets `future: { unstable_skill_docs: true }`.

**`docs/adr/` is yours, not the scribe's.** ADRs are decisions a person made and recorded — `domain-modeling` writes them during `plan`, and you edit them by hand. Everything under `docs/adr/` is outside every managed-docs rule: never written, moved, deleted, migrated or listed in `docs/index.md`, and never what makes `docs/` unmanaged. The scribe reads the ones in scope as settled tradeoffs, and links one rather than restating it.

It runs after the milestone gate is green and before the milestone's Outcome block is written, while its file is as the gate left it — the scribe translates that text and the milestone's diff into docs, at Sonnet, and reports where delivery **drifted** from the plan. Nobody is watching, so nothing here stops the run:

- A question isn't asked now. It becomes `docs skipped: <question>` in the milestone's **Docs advisories**, and its answer later becomes the plan's `**Docs conventions:**` line, passed to every later dispatch.
- An unmanaged `./docs` isn't migrated now either: it becomes `docs skipped: docs/ not qoq-managed — run /qoq document to migrate`. Migration needs you on every doc, so every later milestone skips too — said once, not per milestone, and answered at the end by offering `/qoq document`.
- With [diagrams](./mermaid.md#execute--after-the-scribe) on too, `qoq-artist` runs next, then Prettier.
- The commit holds exactly the files the scribe and the artist wrote or deleted — never `git add -A`, because Prettier formats the whole repo — as `docs(m<N>): <milestone name>`.
- Every drift and every marker goes into **Docs advisories**, one line each, and nowhere else: drift is your decision, and nothing about it is written into `docs/`.

At the end of the run you're walked through every milestone's Docs advisories once. Marker answers are written in place and committed together as `docs: resolve scribe markers`.
