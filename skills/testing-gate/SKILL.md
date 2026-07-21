---
name: testing-gate
description: >-
  Writes valuable unit and integration tests for TypeScript projects — NestJS
  APIs and React components — using Vitest or Jest, React Testing Library, and
  MSW for API/UI interceptors, then runs them and gates the result through
  QoQ's `gate` command before declaring the work done. Use whenever the user
  asks to "test this controller/service/component", "write tests for X", "add
  unit tests", "add integration tests", or otherwise wants test coverage added
  to a JS/TS project on a Vitest-family runner — even if they don't name
  Vitest, Jest, React Testing Library, or QoQ explicitly. Aims for tests that
  cover real functionality, not 100% coverage for its own sake.
argument-hint: '[controller/service/component path, or the behavior to test]'
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Skill
  - Bash(npm test:*)
  - Bash(npm run:*)
  - Bash(yarn test:*)
  - Bash(pnpm test:*)
metadata:
  version: 0.1.0
---

Writes tests that verify real behavior for TypeScript projects — NestJS APIs
and React components — on Vitest or Jest, then proves they're green and holds
them to the project's own quality bar before calling the task done. Five
phases: discover the project's conventions, clarify scope, write the tests,
validate them, gate them.

**Hard dependency: QoQ.** This skill ships inside the QoQ repo alongside the
`qoq` skill, so assume it's installed — no discovery step needed for it. Phase
5 always hands off to QoQ's `gate` command as the final step.

## Phase 1 — Discovery

Run from the project root; nothing needs to be pasted in. Work out, from the
repo itself:

1. **Test runner** — Vitest or Jest.
2. **Whether the runner's config enables globals.** This changes the literal
   syntax of every file this skill writes: with globals on, reference
   `describe`/`it`/`expect` directly with no imports; with globals off, import
   them explicitly at the top of each test file. Read this from the actual
   config (`vitest.config.*`, `jest.config.*`, or the relevant `package.json`
   key) — don't assume either way.
3. **Whether this is a React project.** If so, layer in React Testing Library
   and MSW conventions (Phase 3, detailed in
   [references/conventions.md](references/conventions.md)).
4. **How tests are actually run** — both the scoped command (a single
   file/pattern) and the full-suite command, e.g. `npm test -- path/to/file`
   vs. `npm test`. Read these from `package.json` scripts or the runner's own
   config; needed verbatim for Phase 4.
5. **`testing-gate.md` at the project root.** If present, it's human-written
   and overrides this skill's built-in defaults (Phase 3) wherever the two
   conflict — project-specific helpers, preferred patterns, house style. If
   absent, the built-in defaults in
   [references/conventions.md](references/conventions.md) apply as-is.

**Golden rule, for this phase and the whole skill: never guess.** If any of
the above is ambiguous or can't be pinned down confidently from the repo, ask
the user rather than assuming — guessing wrong here produces test files with
the wrong import style or that get invoked with the wrong command, which is
worse than pausing to ask.

## Phase 2 — Scope clarification

Infer the test type from what the user actually asked for, rather than
defaulting to one type or trying to cover everything in reach:

- A request scoped to one piece with no wider context — "test this
  controller", "add tests for `UserService`" — defaults to **unit tests** for
  that isolated piece.
- A request that describes a flow or behavior spanning multiple pieces —
  "test that submitting the form creates the user and shows a confirmation" —
  is **integration** scope.

State the inferred approach back to the user before writing anything, so a
wrong inference gets caught before it costs a rewrite. Don't turn this into a
clarifying question, though, when the request is already specific enough to
infer from — that just adds a round-trip the user didn't need.

## Phase 3 — Write the tests

Write tests that verify actual functionality and behavior — a valuable test
set beats an exhaustive one, and coverage percentage is a side effect, not the
goal. The concrete conventions (coverage philosophy, what to mock and what
not to, async patterns, React Testing Library and MSW usage, and the
Jest/Vitest/Testing-Library lint rules to write clean against from the start)
live in [references/conventions.md](references/conventions.md) — read it
before writing the first test file. Everything there is a default overridable
by the project's own `testing-gate.md` (Phase 1, step 5).

Apply these conventions invisibly in the code you produce — don't narrate the
rulebook to the user, just produce tests that already follow it.

## Phase 4 — Validate

After writing the tests:

1. Run the specific test(s) just written, using the scoped command discovered
   in Phase 1.
2. Run the full test suite, using the full-suite command discovered in
   Phase 1, to confirm nothing else broke.

Use exactly what Phase 1 discovered — never guess a run command. If Phase 1
couldn't pin one down, stop and ask rather than reaching for a plausible
default like `npm test`, which may not match how this project actually runs
its suite.

## Phase 5 — QoQ gate (mandatory)

QoQ is always present in this repo, so this phase is never optional and never
needs a discovery step of its own. As the final step, gate exactly the test
files this skill just created or modified — pass the explicit file list,
don't let the gate infer scope from the whole working tree, since that could
also catch unrelated dirty files sitting in the project.

Invoke it either way the `qoq` skill itself documents for producer skills:

- Preferably, invoke it directly: `Skill(skill: "qoq", args: "gate <the test
files you just wrote/edited>")`.
- If that invocation path isn't available in the current environment, read
  [../qoq/references/gate.md](../qoq/references/gate.md) and follow its
  phases inline instead — the same outcome, just without going through the
  `qoq` skill's own entry point.

Then follow the contract exactly as `qoq` defines it for callers (see
[../qoq/SKILL.md#consuming-qoq-from-another-skill](../qoq/SKILL.md#consuming-qoq-from-another-skill)):

> Run `/qoq gate <the files you changed>` and wait for its verdict. If it
> returns `FAIL`, fix the reported blockers and re-run it. Only declare the
> task complete on `PASS`; pass along any advisories it reported.

**Do not declare the testing task done until `gate` returns `PASS`.** A green
test run in Phase 4 is necessary but not sufficient — `gate` is what confirms
the new test files meet the project's own formatting, naming, and duplication
standards, not just that they pass.
