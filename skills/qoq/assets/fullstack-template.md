# Fullstack manifest template

The root file `qoq fullstack-plan` writes. It holds what is decided **across**
components and nothing any one of them owns: tickets, estimates and status
live in the component plans, which are ordinary
[plan-template.md](plan-template.md) files. Fill in the `<…>` placeholders;
don't add sections.

```markdown
# <Feature Name> — fullstack plan

**Goal:** <one sentence>
**Requirements source:** <link or short description> · grilled | not grilled
**E2E owner:** <component> — its last milestone is E2E delivery
**Plan status:** draft | approved | complete

---

## Contracts

<the cross-component interface — inline when small, or a path inside the
component that keeps it (`be/openapi.yaml`). Settled here only.>

| Contract | Provider    | Consumers   |
| -------- | ----------- | ----------- |
| <name>   | <component> | <component> |

## Scenarios

- **Given** <the state the user is in> **When** <what they do> **Then** <what
  they observe> — touches <component>, <component>

## Components

| Component | Path     | Plan                            |
| --------- | -------- | ------------------------------- |
| <name>    | `<dir>/` | `<dir>/plans/YYYY-MM-DD-<f>.md` |

## Barriers

| Waits                   | On                               | Why                                |
| ----------------------- | -------------------------------- | ---------------------------------- |
| <component>:Milestone N | <component>:Milestone M          | <the delivered behaviour it needs> |
| <E2E owner>:Milestone K | every other component's last one | E2E delivery                       |
```

## Field notes

- **Status** is not here. It's derived by reading the component plans, every
  time, because in a fan-out several sessions are writing those at once and a
  shared status field would be a race. The one write after approval is
  `Plan status: complete`, made when every component plan is.
- **Contracts** change only through `qoq fullstack-plan` over this file. A
  component that edits one locally leaves the other side asserting a shape that
  no longer exists.
- **Barriers** are the only places the tracks stop running in parallel, so each
  one carries why: a consumer that needs a contract's _shape_ builds against it
  and waits on nothing. Each row is mirrored as the waiting milestone's
  `Depends on: <component>:Milestone <N>` in its own plan, which is what
  `execute` actually checks.
