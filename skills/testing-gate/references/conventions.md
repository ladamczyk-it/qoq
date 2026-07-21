# Conventions

Built-in defaults for Phase 3. Every one of these is overridable by a
project-root `testing-gate.md` (see [SKILL.md](../SKILL.md), Phase 1 step 5)
wherever the two conflict — that file is human-written and knows things about
the project this skill can't infer.

## Coverage philosophy

Cover happy paths **and** reasonable edge cases / negative scenarios. Don't
chase covering every line or branch just to hit a number — a valuable test
set beats an exhaustive one. If a test doesn't exercise a real risk (a branch
that could actually be wrong, an input that could actually arrive), it's
padding, not coverage.

## Mocking philosophy

This is the most common failure mode in generated tests, so be deliberate
about it rather than mocking reflexively:

- **Mock** things that are external, cause side effects, are non-deterministic,
  or are necessary to isolate the unit under test / provide required context
  (a database client, a clock, an HTTP call, a NestJS provider the unit under
  test depends on but isn't itself being tested).
- **Don't mock** dependencies that don't mutate anything and are already
  well-tested on their own — a mock here adds noise and ceremony without
  reducing risk. Prefer the real implementation whenever it's cheap and
  deterministic to use.
- **Rule of thumb:** if the test would break or become flaky without the
  mock, it belongs. If the mock exists only for ceremony — nothing about the
  test's correctness depends on it — drop it.

## Async patterns

Use `async`/`await` (with `try`/`catch` where the test needs to assert on a
thrown error) over promise chains — it keeps the control flow of the test
readable and matches how the code under test is almost always written. In
React Testing Library tests, prefer `waitFor` over older callback-style async
utilities for anything that resolves asynchronously (effects, data fetching,
debounced updates).

## React Testing Library conventions

When Phase 1 identifies the project as React:

- Prefer `userEvent` over `fireEvent` — it more closely simulates what a real
  user does (a click dispatches the full sequence of events a browser would,
  not just the one event `fireEvent` fires). `userEvent` methods are async —
  always `await userEvent.click(...)`, not a bare call.
- Query by role or other accessible attributes (`getByRole`, `getByLabelText`)
  over test IDs where practical — it tests the component the way an assistive
  technology or a real user encounters it, and breaks less on internal
  refactors that don't change behavior. Whether the query is written as
  `screen.getByRole(...)` or destructured off `render()`'s return value is a
  free choice — this repo's own lint config doesn't prefer one over the other.
- Query the DOM only through Testing Library's own query functions — reaching
  past them into `container.querySelector` or other raw DOM traversal defeats
  the accessibility-first querying above and couples the test to markup
  structure instead of user-visible behavior.
- Test what the user sees and does, not implementation details (internal
  state, private methods, component instances).

## MSW

Use MSW to intercept API calls at the network boundary in integration tests
between UI and API, rather than mocking the fetch/HTTP client directly.
Mocking the client couples the test to _how_ the request is made; intercepting
at the network level couples it to _what_ the API contract actually is, which
is what the test should care about.

## Writing lint-clean by construction

QoQ's own `eslint-v9-{js,ts}-{jest,vitest}(-rtl)` configs (the ones a project
built on this repo's ESLint templates will run) hard-enforce a handful of
Jest/Vitest/Testing-Library rules on spec files. `gate` (Phase 5) would catch
violations of these anyway, but writing to them up front means Phase 5 has
nothing left to fix — treat every point below as how a valid test is
structured, not an extra pass to run afterward:

- **Never commit a focused or disabled test** — no `.only`, no `.skip`, no
  `fit`/`xit`/`fdescribe`/`xdescribe`. If a test doesn't pass, fix it or leave
  it out; a skipped test sitting in the suite is a silent gap in coverage
  wearing the disguise of a real one.
- **Every `describe`/`it`/`test` title is a real, unique, non-empty string**
  within its scope — two tests in the same `describe` block with identical
  titles make failures ambiguous about which one actually broke.
- **Every test contains at least one assertion.** A test with no `expect`
  call always trivially passes and asserts nothing — it's a false signal of
  coverage.
- **Never gate a test's registration on an `if`** — a conditionally
  registered `it`/`describe` can silently vanish from the suite depending on
  environment. If two branches genuinely need different coverage, write two
  tests, not one test wrapped in a condition. The same reasoning applies
  inside a test body: branching around an assertion (`if (x) expect(...)`)
  means only one path is ever actually checked per run — split it instead.
- **`await` the test body instead of returning it.** Returning a promise from
  a test function works by accident in some runners and not others — `await`
  makes the intent explicit and the failure mode (an unhandled rejection)
  visible in the right place.
- **Declare each lifecycle hook once per block, in natural order** —
  `beforeAll` → `beforeEach` → `afterEach` → `afterAll`. Two `beforeEach`
  calls in the same `describe` is almost always a sign the setup should be
  merged into one.
- **Keep `describe` nesting shallow.** Reach for more top-level `describe`
  blocks (or split the file) instead of nesting three or more levels deep —
  deep nesting is a readability cost, not a categorization tool.
- **Pass a message or matcher to `toThrow`.** A bare `expect(fn).toThrow()`
  only proves _something_ threw, not the _right_ thing — prefer
  `toThrow('specific message')`, a regex, or an error class.
- **Prefer `toBe` for primitives, `toStrictEqual` for objects, over a bare
  `toEqual`.** `toEqual` ignores `undefined`-valued keys and prototype/class
  differences, which can hide a real bug — e.g. it treats a class instance
  and an equivalent plain object as equal. `toBe`'s referential check is
  simpler and sufficient for strings/numbers/booleans/null/undefined.
- **Match the assertion matcher to the value's actual type** (TypeScript
  projects) — e.g. don't call `.toHaveLength()` on something that isn't
  array- or string-like, or `.toBeCloseTo()` on a non-number.
- **Don't let a snapshot grow large.** A multi-hundred-line snapshot nobody
  reviews line-by-line isn't a meaningful assertion — assert the specific
  fields that matter instead of snapshotting an entire object graph.

These reflect this monorepo's own Jest/Vitest + Testing Library lint
defaults; if Phase 1 finds the target project on a different ESLint setup,
they're still sensible defaults grounded in how these test-runner ecosystems
work, just no longer independently lint-enforced there.

## TypeScript relaxations in test files

Two rules that apply to production TypeScript code are deliberately relaxed
in spec files under this repo's own `eslint-v9-ts-*` test configs — worth
knowing so you don't over-engineer test code to satisfy a rule that isn't
actually active there:

- `@typescript-eslint/no-unsafe-assignment`/`-argument`/`-member-access` are
  off in test files. A loosely-typed mock or stub doesn't need casting
  gymnastics just to appease these — that ceremony belongs in production
  code, not in a test double that's already inherently loosely typed.
- `sonarjs/no-duplicate-string` is off in test files. Repeating the same
  literal (e.g. the same expected error message across several `expect`
  calls) doesn't need to be hoisted into a shared constant purely for this
  rule's sake — do it only if it genuinely improves readability.
