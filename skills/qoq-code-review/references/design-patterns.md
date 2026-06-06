# Design patterns & code smells — JS/TS review catalog

A local, offline reference for the `patterns.patch` analysis. Read this instead of fetching the web. It maps the **smell you see in a diff** to the **standard pattern that resolves it**, with JS/TS-idiomatic notes. The catalog is distilled from the GoF patterns and Refactoring Guru's smell taxonomy — but adapted to how JS/TS is actually written (closures, first-class functions, modules, async), so don't transplant a Java-shaped class hierarchy where a function or a plain object does the job.

The cardinal rule for this skill: **a pattern is only worth proposing if a maintainer would find the result easier to extend, and it does not raise cognitive complexity.** A pattern applied for its own sake is itself a smell. When in doubt, leave the code alone.

## Table of contents

- [How to use this](#how-to-use-this)
- [Smell → pattern quick index](#smell--pattern-quick-index)
- [Code smells](#code-smells)
- [Creational patterns](#creational-patterns)
- [Structural patterns](#structural-patterns)
- [Behavioral patterns](#behavioral-patterns)
- [React patterns](#react-patterns)
- [JS/TS anti-patterns to flag](#jsts-anti-patterns-to-flag)

---

## How to use this

1. Read the changed code and name the smell (use the index below).
2. Find the candidate pattern(s) it points to.
3. Sanity-check against the cardinal rule — would the patterned version genuinely read better and lower complexity? If not, drop it.
4. In `patterns.patch`, propose the smallest change that introduces the pattern, name the pattern, and write one sentence on _why this situation calls for it_.

---

## Smell → pattern quick index

| Smell in the diff                                     | Candidate pattern                   | Section                                     |
| ----------------------------------------------------- | ----------------------------------- | ------------------------------------------- |
| `switch`/`if-else` chain on a `type`/`kind` field     | Strategy, polymorphism, lookup map  | [Strategy](#strategy)                       |
| Boolean/enum flag parameter that forks behavior       | Strategy / split function           | [Strategy](#strategy)                       |
| `new ConcreteThing()` scattered, hard to swap impls   | Factory / Factory Method            | [Factory Method](#factory-method)           |
| Multi-step object construction, telescoping args      | Builder                             | [Builder](#builder)                         |
| Manual instance caching / global singleton-ish module | Singleton (often just a module)     | [Singleton](#singleton)                     |
| Incompatible interface bridged inline repeatedly      | Adapter                             | [Adapter](#adapter)                         |
| Wrapping a call to add logging/caching/retry          | Decorator                           | [Decorator](#decorator)                     |
| Deep reach-through `a.b.c.d` to a subsystem           | Facade                              | [Facade](#facade)                           |
| Manual subscriber lists / event wiring                | Observer / EventEmitter             | [Observer](#observer)                       |
| Conditional that varies an algorithm's steps          | Template Method                     | [Template Method](#template-method)         |
| State-dependent behavior via flags & nested ifs       | State                               | [State](#state)                             |
| Long parameter list of primitives                     | Parameter Object / Introduce Object | [Long parameter list](#long-parameter-list) |
| Repeated `try/catch`-and-return patterns              | Result/Either return, or wrapper    | [Decorator](#decorator)                     |
| Data + the functions on it living apart               | Encapsulate into a class/module     | [Feature envy](#feature-envy)               |

---

## Code smells

These are the conditions that justify a pattern. Name the smell first — it is more convincing than naming the pattern.

- **Long method / high cognitive complexity** — extract well-named helpers, replace nested conditionals with early returns. Overlaps with the `complexity.patch` dimension; coordinate so you don't double-report.
- **Large class / God object** — one unit doing several jobs. Split by responsibility (Extract Class).
- **Long parameter list** — 4+ positional args, especially booleans/primitives. See [Long parameter list](#long-parameter-list).
- **Switch statements on a type tag** — recurring `switch (x.kind)` that the same shape appears in multiple places. See [Strategy](#strategy).
- **Shotgun surgery** — one conceptual change forces edits in many files; a missing abstraction. Often a Facade or a centralized config/factory.
- **Feature envy** — a method that mostly manipulates another object's data. See [Feature envy](#feature-envy).
- **Primitive obsession** — strings/numbers standing in for a domain concept (e.g. a raw string everywhere a `UserId` is meant). Introduce a small type/branded type or value object.
- **Flag argument** — a boolean param that makes the function do two things. Split into two functions, or pass a strategy.
- **Message chains** — `a.getB().getC().getD()`; couples the caller to deep structure. Hide behind a method (Facade / Law of Demeter).

---

## Creational patterns

### Factory Method

**Use when:** the diff scatters `new ConcreteX()` and the concrete type may need to vary, or construction needs validation/defaults in one place.
**JS/TS note:** a plain factory function (`createX(opts)`) is usually enough — you rarely need an abstract creator class. Return a union/interface type so callers don't depend on the concrete class.
**Don't:** introduce a factory for a type that has exactly one implementation and no construction logic — `new X()` is clearer.

### Builder

**Use when:** an object needs many optional fields or a multi-step assembly, and you're seeing telescoping constructors or a giant options object mutated step by step.
**JS/TS note:** an options object (`new Thing({ a, b, c })`) covers most cases; reserve a fluent builder for genuinely staged construction (e.g. query builders).
**Don't:** add a builder where a single options object reads fine.

### Singleton

**Use when:** exactly one shared instance must exist (a connection pool, a config registry).
**JS/TS note:** an ES module _is_ a singleton — a module-level `const instance = ...` with named exports is the idiomatic form. A classic `getInstance()` with a private static field is rarely needed and complicates testing.
**Don't:** reach for Singleton to share state that should be passed explicitly — it hides dependencies and breaks tests.

---

## Structural patterns

### Adapter

**Use when:** changed code bridges an incompatible interface (third-party SDK shape vs. your domain shape) inline, and that translation appears more than once.
**Fix:** centralize the translation in one adapter module/function so callers see only your interface.

### Decorator

**Use when:** the diff wraps an existing call to add a cross-cutting concern — logging, caching, retry, timing, auth — and the wrapping is duplicated.
**JS/TS note:** a higher-order function (`withRetry(fn)`, `withCache(fn)`) is the idiomatic decorator; you don't need the class-based form. Composes cleanly: `withLogging(withRetry(fn))`.
**Don't:** stack so many wrappers that the call site becomes inscrutable.

### Facade

**Use when:** callers reach deep into a subsystem (`service.client.transport.send(...)`) or must orchestrate several low-level steps in the right order, repeatedly.
**Fix:** expose one high-level method that encapsulates the sequence. Reduces message chains and shotgun surgery.

---

## Behavioral patterns

### Strategy

**Use when:** behavior is selected by a `type`/`kind`/`mode` field via `switch`/`if-else`, _especially_ when the same branching shape recurs, or a boolean flag forks a function into two behaviors.
**Fix:** map each case to a function/object and select by key:

```ts
const handlers: Record<Kind, (input: Input) => Output> = {
  email: handleEmail,
  sms: handleSms,
  push: handlePush,
};
const run = handlers[kind]; // throws/falls back if unknown
```

**Why it helps:** adding a case is one new entry, not edits across every `switch`. Lowers cognitive complexity by flattening branches.
**Don't:** convert a single, local two-branch `if` into a strategy map — that's more indirection than it saves.

### Template Method

**Use when:** two or more flows share the same skeleton but differ in a step or two (e.g. parse → _transform_ → save, where only transform differs).
**JS/TS note:** pass the varying step(s) as functions rather than subclassing.

### Observer

**Use when:** the diff hand-rolls subscriber arrays, manual `listeners.push` / loop-and-call, or ad-hoc event wiring.
**JS/TS note:** prefer the platform — `EventTarget`, Node's `EventEmitter`, or an existing reactive lib — over a bespoke implementation.

### State

**Use when:** an object's behavior depends on a `status`/`phase` field and the code is a thicket of `if (status === ...)` guards repeated across methods.
**Fix:** model each state's behavior together so transitions and per-state logic live in one place.
**Don't:** introduce a full state machine for two states with one branch.

---

## Long parameter list

**Use when:** a function takes 4+ positional parameters, or several that always travel together (`x, y, width, height`), or a run of booleans.
**Fix:** Introduce Parameter Object — group related args into a named object/type. Improves call-site readability (named fields) and makes adding a field non-breaking.

```ts
// before
function draw(x, y, width, height, filled, dashed) {}
// after
function draw(rect: Rect, style: DrawStyle) {}
```

## Feature envy

**Use when:** a function in module A spends most of its body poking at module B's data.
**Fix:** move the behavior next to the data it operates on (Move Method), or encapsulate the data so the operation belongs to its owner.

---

## React patterns

React has its own pattern vocabulary on top of the GoF set — most of the "classic" patterns show up here as hooks or composition rather than classes. Apply the same cardinal rule: only propose one if it genuinely simplifies the component and doesn't add indirection. Skip this whole section if the diff has no `.tsx`/`.jsx` or React imports.

### Smell → pattern quick index (React)

| Smell in the diff                                            | Candidate pattern                |
| ------------------------------------------------------------ | -------------------------------- |
| Stateful logic (effect + state) duplicated across components | Custom hook                      |
| Deep prop drilling through many layers                       | Context (or composition)         |
| Sprawling `useState` with interdependent updates             | `useReducer`                     |
| Parent rigidly configuring a child via many boolean props    | Compound components              |
| Component does data-fetching _and_ rendering, hard to test   | Container / presentational split |
| `useEffect` syncing state that could be derived              | Derived state (drop the effect)  |
| `useEffect` used to call an event handler on a click         | Move logic into the handler      |
| Sharing behavior via a wrapper component                     | Custom hook (preferred) or HOC   |

### Custom hook

**Use when:** the same `useState`/`useEffect`/subscription logic appears in more than one component, or a component mixes unrelated stateful concerns.
**Fix:** extract the logic into a `useThing()` hook that returns the values/handlers. This is React's primary reuse mechanism — it replaces most render-props and HOC use cases.
**Don't:** extract a one-off hook used by a single component just to "tidy" — inline is clearer until there's a second caller.

### `useReducer` over tangled `useState`

**Use when:** several pieces of state update together, or the next state depends on the previous in non-trivial ways, and the diff shows multiple `setX` calls that must stay in sync.
**Fix:** model transitions as a reducer so related updates happen atomically and the logic is testable in isolation (a pure function). This is the [State](#state) pattern in React clothing.

### Context for prop drilling

**Use when:** a value is threaded through several layers of components that don't use it themselves, purely to reach a deep child.
**Fix:** a Context provider + `useContext`. **First** consider whether component _composition_ (passing JSX as `children`/props) removes the drilling without Context — it's lighter.
**Don't:** put high-frequency-changing state in a wide Context — every consumer re-renders. Scope contexts narrowly.

### Compound components

**Use when:** a parent exposes a pile of boolean/config props to control a child's structure (`showHeader`, `headerTitle`, `footerActions`...).
**Fix:** let consumers compose subcomponents that share implicit state via Context: `<Tabs><Tabs.List/><Tabs.Panel/></Tabs>`. More flexible, fewer props.

### Container / presentational split

**Use when:** a component both fetches/derives data and renders complex markup, making it hard to test or reuse the visuals.
**Fix:** separate a data "container" (hooks, fetching, state) from a presentational component that takes props and just renders. Note: with custom hooks this split is often unnecessary — a hook for the data + one component is frequently enough, so don't force the two-file version.

### Render props & HOCs (legacy)

**Recognize but rarely propose.** Render-props (`<X>{(v) => ...}</X>`) and higher-order components (`withAuth(Component)`) were the pre-hooks reuse tools. If the diff _adds_ one, suggest a custom hook instead. Leave existing ones alone unless they're actively causing wrapper-hell or prop-collision bugs.

### React-specific smells worth a `patterns.patch` note

- **Derived state stored in state** — `useState` + `useEffect` that just mirrors a prop/computation. Compute it during render instead; drop the effect.
- **Effect doing event-handler work** — logic that should run on a user action lives in `useEffect` reacting to a state change. Move it into the handler.
- **Missing/incorrect `key`** — index-as-key on reorderable lists; flag it (correctness, not just style).
- **Unstable props** — inline object/array/function literals passed to memoized children, defeating `React.memo`; `useMemo`/`useCallback` only where it measurably matters, not everywhere.
- **Giant component** — a 300-line component mixing data, layout, and handlers → extract hooks and subcomponents (the React form of Long method / God object).

## JS/TS anti-patterns to flag

These aren't GoF patterns but are common in JS/TS reviews and worth a `patterns.patch` note:

- **Callback nesting / promise pyramids** → flatten with `async/await`.
- **Mutating shared/input objects** → return new values; prefer immutability for predictable data flow.
- **`any` escape hatches** that defeat the type system → narrow to a real type or `unknown` + a guard.
- **Re-implementing stdlib** (manual `for` to build a map, hand-rolled deep clone) → use `Map`/`Object.fromEntries`/`structuredClone`.
- **Barrel-of-flags config** spreading through call signatures → consolidate into a typed config object passed once.
