# Program template

A program sits in an unversioned parent folder that holds the repos it spans:

```
<project>/
  program.json                 # the repos — written once, reused by every program
  program/<slug>/brd.md        # one per program: the master plan
  contracts/<name>.md          # written by the providing repo's session
  <repo>/  <repo>/  …          # independent git repos, each with its own plans/
```

`scripts/program-status.mjs` parses both files below by their table headers, so
keep the column names exactly as written.

## `program.json`

```json
{
  "repos": [
    { "name": "be", "path": "trackbook-be", "role": "api" },
    { "name": "telemetry", "path": "trackbook-telemetry", "role": "api" },
    { "name": "ui", "path": "trackbook-remix-fe", "role": "ui", "after": ["be", "telemetry"] }
  ],
  "integration": [{ "name": "e2e", "repo": "ui", "script": "test:e2e" }],
  "permissionMode": "auto"
}
```

- **`name`**: what `<repo>:M<N>` references use. **`path`**: relative to the parent folder.
- **`after`**: the repos whose plans must be approved before this repo starts planning,
  because it consumes their contracts. Omit it and the repo plans in parallel with the others.
- **`permissionMode`**: the `--permission-mode` every repo session starts in,
  chosen by the user. A background session that hits a permission prompt
  waits for nobody.
- **`integration`**: named checks, each one an `npm run <script>` in one repo. Master
  milestones list them by name.

## `program/<slug>/brd.md`

```markdown
# <Feature Name> — Program

**Goal:** <one sentence, in the user's terms>
**Program status:** draft | approved | in-progress | complete
**Branch:** program/<slug>
**Chief of staff:** <the session name the repo sessions message>

## Actors

- <who uses it, in business terms>

## Scenarios

### S1: <name> (M1)

- **Given** <state of the world>
- **When** <the actor does something>
- **Then** <the observable business outcome>

## Master milestones

| #   | Milestone | Status   | Depends on | Integration |
| --- | --------- | -------- | ---------- | ----------- |
| M1  | <Name>    | <status> | none       | e2e         |
| M2  | <Name>    | <status> | M1         | none        |

## Parked technology questions

- <raised during business grilling, verbatim>

## Repo plans

| Repo      | Plan                      |
| --------- | ------------------------- |
| telemetry | none                      |
| be        | `plans/2026-11-18-<slug>` |
```

**Status** uses the same values as a plan's milestone rows. Only the chief of staff
writes `delivered <YYYY-MM-DD>`, and only after the integration check passes.
**Integration** is `none` only if the user said so while the BRD was being written.
A **Repo plans** row of `none` is a repo that answered "no changes needed" and
the user approved: it gets no session in `execute`.

## Contracts and the repo plans

The `contracts/<name>.md` shape, the **Program** header line and the **Serves**
column are part of `qoq`'s plan format, because `qoq plan` writes them. See
`qoq`'s `assets/plan-template.md`, section "A repo's share of a program". They
aren't repeated here.
