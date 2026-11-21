# Test conventions

The house rules for writing specs in a QoQ project, layered on **`tdd`** — the
base: what a good test is, seams, mocking at system boundaries only, the
anti-patterns, the red → green loop. Its `SKILL.md` is preloaded into every
agent that writes or reviews a spec, and `tests.md` and `mocking.md` sit in its
base directory; this file adds what's specific to
QoQ and wins where the two conflict. The project's own `testing-gate.md` — the
file named on the record's `conventions` field — wins over both. That file is
human-written and knows things this skill can't infer.

**Readable on its own.** Nothing below depends on the rest of the skill, which is
deliberate: most tests in a plan-driven project aren't written by `qoq test` at
all, but by `qoq-developer` implementing the feature they cover. What it won't
give you is the runner, the `globals` setting, or the run commands; those are on
the record.

## React Testing Library

When the record's `react` field is true:

- `userEvent` over `fireEvent` — a click dispatches the full event sequence a
  browser would, not the single event `fireEvent` fires. Its methods are async:
  `await userEvent.click(...)`, never a bare call.
- Query by role or accessible attribute (`getByRole`, `getByLabelText`) over test
  IDs where practical. Whether the query is `screen.getByRole(...)` or
  destructured off `render()` is a free choice — this repo's lint config has no
  preference.
- Query the DOM **only** through Testing Library's own functions. Reaching past
  them into `container.querySelector` couples the test to markup structure and
  defeats the accessibility-first querying above.
- `waitFor` over older callback-style async utilities for anything that resolves
  asynchronously — effects, data fetching, debounced updates.

## MSW

Intercept API calls at the network boundary in UI↔API integration tests rather
than mocking the fetch/HTTP client. Mocking the client couples the test to _how_
the request is made; intercepting couples it to _what_ the API contract is, which
is what the test should care about.

## Writing lint-clean by construction

QoQ's own `eslint-v9-{js,ts}-{jest,vitest}(-rtl)` configs hard-enforce these on
spec files. `qoq fix` would catch a violation anyway, but writing to them up
front leaves the gate nothing to do — treat them as how a valid test is
structured, not a pass to run afterwards:

- **No focused or disabled tests** — no `.only`, `.skip`, `fit`, `xit`,
  `fdescribe`, `xdescribe`. A skipped test is a coverage gap wearing the disguise
  of a real one.
- **Every `describe`/`it`/`test` title is a real, unique, non-empty string**
  within its scope — duplicate titles make a failure ambiguous about which test
  broke.
- **Every test contains at least one assertion.** A test with no `expect` always
  passes and asserts nothing.
- **Never gate a test's registration on an `if`.** A conditionally registered
  `it`/`describe` can silently vanish depending on environment. Same inside the
  body: `if (x) expect(...)` checks one path per run — split it into two tests.
- **`await` the test body instead of returning it.** Returning a promise works by
  accident in some runners and not others; `await` puts the failure where you can
  see it.
- **Declare each lifecycle hook once per block, in natural order** — `beforeAll`
  → `beforeEach` → `afterEach` → `afterAll`. Two `beforeEach` calls in one
  `describe` almost always means the setup should be merged.
- **Keep `describe` nesting shallow** — more top-level blocks, or a second file,
  rather than three levels deep.
- **Pass a message or matcher to `toThrow`.** A bare `expect(fn).toThrow()` only
  proves _something_ threw.
- **`toBe` for primitives, `toStrictEqual` for objects, over a bare `toEqual`.**
  `toEqual` ignores `undefined`-valued keys and prototype differences — it treats
  a class instance and an equivalent plain object as equal, which hides real bugs.
- **Match the matcher to the value's actual type** (TypeScript projects) — no
  `.toHaveLength()` on a non-array, no `.toBeCloseTo()` on a non-number.
- **Don't let a snapshot grow large.** A multi-hundred-line snapshot nobody
  reviews isn't an assertion — assert the fields that matter.

If the target project turns out to be on a different ESLint setup these are still
sound defaults, just no longer independently enforced there.

## Relaxations in test files

Three checks that apply to production code are deliberately **off** in spec
files: two in this repo's `eslint-v9-ts-*` test configs, and JSCPD through its
default ignore. They're worth knowing so you don't over-engineer test code to
satisfy a check that isn't running:

- `@typescript-eslint/no-unsafe-assignment`/`-argument`/`-member-access`. A
  loosely-typed mock doesn't need casting gymnastics.
- `sonarjs/no-duplicate-string`. Repeating an expected error message across
  several `expect` calls doesn't need hoisting into a constant for this rule's
  sake — only if it genuinely reads better.
- **JSCPD**, which ignores `**/*.spec.*` and `**/*.test.*` by default. An
  expected value pinned from source stays a literal in the spec: importing it
  makes the assertion compare the code with itself, so it can never fail. If
  JSCPD still flags spec against source, the project's `jscpd.ignore` is missing
  that spec's glob — the fix is that glob in `qoq.config`, never a change to
  either file.
