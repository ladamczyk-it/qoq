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
  - Bash(npx:*)
  - Bash(yarn test:*)
  - Bash(yarn run:*)
  - Bash(pnpm test:*)
  - Bash(pnpm run:*)
  - Bash(vitest:*)
  - Bash(jest:*)
metadata:
  version: 0.2.0
---

Writes tests that verify real behavior for TypeScript projects — NestJS APIs
and React components — on Vitest or Jest, then proves they're green and holds
them to the project's own quality bar before calling the task done. Five
phases: discover the project's conventions, clarify scope, write the tests,
validate them, gate them.

**Hard dependency: QoQ.** This skill ships inside the QoQ repo alongside the
`qoq` skill, so assume it's installed — no discovery step needed for it. Phase
5 always hands off to QoQ's `gate` command as the final step.

## When to use it

Use it whenever a JS/TS project needs unit or integration tests written
against code that already exists — a controller, a service, a component, or a
described behavior spanning a few of them.

Two boundaries are worth naming, because crossing either quietly turns a
testing task into something the user didn't ask for:

- **This skill tests code; it does not fix code.** If a test exposes a real
  bug in the thing under test, that's a finding to report, not a licence to
  edit production source. See
  [When the tests won't pass](#when-the-tests-wont-pass).
- **In-process runners only** — Vitest or Jest, with React Testing Library
  and MSW where the project is React. Browser-driving end-to-end suites
  (Playwright, Cypress) are a different discipline with different conventions;
  this skill's defaults don't transfer, so say so rather than improvising.

## Phase 1 — Discovery

Run from the project root; nothing needs to be pasted in. Work out, from the
repo itself:

1. **Test runner** — Vitest or Jest.
2. **Whether the runner's config enables globals.** This changes the literal
   syntax of every file this skill writes. Read it from the actual config
   (`vitest.config.*`, `jest.config.*`, or the relevant `package.json` key) —
   don't assume either way. For example, with `globals: true`:

   ```ts
   describe('UserService', () => {
     it('returns null for an unknown id', async () => {
       await expect(service.findById('nope')).resolves.toBeNull();
     });
   });
   ```

   and with globals off, the same file needs the imports:

   ```ts
   import { describe, it, expect } from 'vitest';
   ```

   Getting this backwards is the single most common way a generated test file
   fails to run at all, which is why it's discovered rather than assumed.

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

## When the tests won't pass

A red test is information, and the right response depends entirely on _what_
is broken. Diagnose before touching anything, because the three cases have
opposite correct answers:

1. **The test is wrong** — bad setup, a mock that doesn't match the real
   signature, a wrong expectation. Fix the test. This is the only case where
   editing is the answer.
2. **The code under test is genuinely broken** — the test is right and it
   caught a real bug. Report it and stop. If the user asked for tests, then
   editing production source to make your own test green is scope they never
   granted, and it destroys the finding: a bug silently fixed in the same
   change that "added tests" is a bug nobody ever learns about. Show the
   failing assertion and what it proves, and let the user decide.
3. **The code isn't testable as written** — a dependency constructed inline
   with no seam to inject, a module-level side effect on import. Say so,
   name the smallest change that would open a seam, and ask before making
   it. Restructuring production code is a refactor, not a test.

**Three attempts, then stop.** One attempt is: fix, re-run. If Phase 4 or
Phase 5 is still red after the third, report what's blocking rather than
trying a fourth time. Report immediately, without spending attempts, when the
blocker is case 2 or 3 — those aren't fixable by retrying, so retries only
burn time.

When reporting back, quote the actual failure — the assertion diff, or the
verbatim `qoq` `FAIL` text. A caller that dispatched this skill (a
`planning-gate` ticket, for instance) is deciding what to do next based on
that text, and a paraphrase costs it the detail it needs.

**Never buy green.** Deleting the failing case, adding `.skip`, loosening an
assertion until it can't fail, or asserting the buggy behavior as if it were
correct — each converts a real signal into a permanent silent gap, and the
suite now actively lies about what's covered. A reported failure is a
successful outcome for this skill; a fake pass is the one true failure.

## Anti-patterns

The recurring mistakes in generated test suites, and what each actually costs.
The full rule set lives in
[references/conventions.md](references/conventions.md) — these are the ones
worth keeping in mind before the first line is written:

| Pitfall                                                                     | Why it bites                                                                                                                                                                                               |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mocking reflexively, including well-tested pure dependencies                | Ceremony without risk reduction, and the test stops proving the pieces work together. Mock what's external, non-deterministic, or side-effecting; prefer the real thing when it's cheap and deterministic. |
| Chasing a coverage number                                                   | Produces tests that execute lines without asserting on real risk. A valuable test set beats an exhaustive one; coverage is a side effect.                                                                  |
| Testing implementation details — internal state, private methods, instances | Breaks on every refactor that changes nothing a user could observe, which trains people to distrust and delete tests.                                                                                      |
| Guessing the run command instead of using Phase 1's                         | A plausible-looking `npm test` may not be how this project runs its suite; the "green" you report was never actually observed.                                                                             |
| Assuming the globals setting                                                | Wrong either way means a file that can't even execute. It's two lines of config to check.                                                                                                                  |
| Editing production code to make a test pass                                 | Silently converts a caught bug into an unreported one. Report it instead.                                                                                                                                  |
| Leaving `.skip`/`.only`, or a test with no `expect`                         | A gap wearing the costume of coverage — worse than no test, because it reads as covered.                                                                                                                   |
| Snapshotting an entire object graph                                         | Nobody reviews a 300-line snapshot, so it asserts nothing and fails noisily on unrelated change. Assert the fields that matter.                                                                            |
