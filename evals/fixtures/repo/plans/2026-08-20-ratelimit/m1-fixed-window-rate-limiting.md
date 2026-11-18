# Milestone 1: Fixed-window rate limiting

Part of [Rate Limiting](index.md).

## Scope

**Size:** S
**Goal:** A caller can ask whether a client's request is allowed and get back the HTTP status and headers to answer it with.
**Depends on:** none
**Contracts:**

```ts
// src/limiter.ts
export interface IRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number; // set only when allowed is false
}
export interface ILimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}
export declare const createLimiter: (options: ILimiterOptions) => {
  hit(key: string): IRateLimitResult;
};

// src/rate-limit.ts
export interface IRateLimitResponse {
  status: 200 | 429;
  headers: Record<string, string>;
}
export declare const toResponse: (result: IRateLimitResult) => IRateLimitResponse;
```

**Scenarios:**

- **Given** a client who has made fewer requests than the limit in this window **When** they make another **Then** it succeeds and they can see how many requests they have left
- **Given** a client who has used up the window **When** they make another request **Then** it is refused, and they are told how many seconds to wait
- **Given** a refused client **When** the window has passed **Then** their next request succeeds

## Tickets

### Ticket 1.1: Fixed-window limiter

- **Status:** todo
- **Size:** S
- **Depends on:** none
- **Files:**
  - Create: `src/limiter.ts`
  - Test: `src/limiter.spec.ts`

**Context:** The project has no rate limiting yet. Implement `createLimiter` exactly as the milestone Contract types it, in `src/limiter.ts`. State lives in a `Map<string, { windowStart: number; count: number }>` inside the closure; the clock is `options.now ?? Date.now`, so specs drive time through `now` rather than fake timers. A key's window opens on its first hit. ESM with `.js` import suffixes (`moduleResolution: NodeNext`).

**Acceptance criteria:**

- [ ] With `limit: 3`, the first three hits for one key inside a window return `allowed: true` with `remaining` 2, 1, 0
- [ ] The fourth hit inside the same window returns `allowed: false`, `remaining: 0`, and `retryAfterMs` equal to the time left until the window closes
- [ ] Exhausting key `a` leaves key `b`'s first hit at `allowed: true, remaining: 2`
- [ ] Once `windowMs` has elapsed since a key's first hit, its next hit returns `allowed: true, remaining: 2`

#### Execution

- **Complexity:** mechanical
- **Agent tier:** `haiku`
- **Estimate:** `mechanical` · stack `node` · baseline 0/0
- **Escalation:** none

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:** none

- **Log:**

**Commit:** none

### Ticket 1.2: Map a limiter result onto an HTTP response

- **Status:** todo
- **Size:** XS
- **Depends on:** Ticket 1.1
- **Files:**
  - Create: `src/rate-limit.ts`
  - Test: `src/rate-limit.spec.ts`

**Context:** `src/limiter.ts` (Ticket 1.1) exports `IRateLimitResult` exactly as the milestone Contract types it. Add `toResponse` in `src/rate-limit.ts`: a pure function, no I/O, importing the type from `./limiter.js`. Header names are the conventional `X-RateLimit-Remaining` and `Retry-After`; header values are strings.

**Acceptance criteria:**

- [ ] An allowed result with `remaining: 4` maps to `status: 200` and `X-RateLimit-Remaining: "4"`
- [ ] A refused result maps to `status: 429` and `X-RateLimit-Remaining: "0"`
- [ ] A refused result's `Retry-After` header is `retryAfterMs` in whole seconds, rounded up: `1001` → `"2"`, `1000` → `"1"`
- [ ] An allowed result carries no `Retry-After` header

#### Execution

- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `mechanical` · stack `node` · baseline 0/0
- **Escalation:** none

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:** none

- **Log:**

**Commit:** none

## Definition of done

- [ ] All tickets above are `done`
- [ ] `qoq refactor --decisions auto src/limiter.ts src/limiter.spec.ts src/rate-limit.ts src/rate-limit.spec.ts` → clean
- [ ] Project's full build + full test suite green
- [ ] Sheriff on: `qoq-sheriff` over the milestone's diff, its findings recorded on the Outcome block's **Security** line
- [ ] Both results written into the Outcome block's **Gate evidence**
- [ ] Milestone delivered: Outcome block written at the top of this file, the index row set to `delivered <YYYY-MM-DD>`
