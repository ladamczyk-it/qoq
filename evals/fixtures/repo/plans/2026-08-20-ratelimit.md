# Rate Limiting Implementation Plan

**Goal:** Cap each client at a fixed number of requests per window and tell a throttled client when to retry.
**Architecture:** An in-memory fixed-window limiter keyed by client id, and a pure function that maps its result onto an HTTP status and headers. No framework binding — the caller wires it into its own handler.
**Requirements source:** "Rate-limit the public endpoints: N requests per window per client, 429 with Retry-After once over."
**Commands:** build `npm run build` · test `npm test`
**Plan status:** approved

---

## Milestone 1: Fixed-window rate limiting

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

### Ticket 1.1: Fixed-window limiter

- **Status:** todo
- **Size:** S
- **Complexity:** mechanical
- **Agent tier:** `haiku`
- **Estimate:** `mechanical` · stack `node` · baseline 0/0
- **Escalation:** none
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
- **Complexity:** moderate
- **Agent tier:** `sonnet`
- **Estimate:** `mechanical` · stack `node` · baseline 0/0
- **Escalation:** none
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

**Definition of done:**

- [ ] `qoq fix <files above>` → PASS
- [ ] `qoq-test-reviewer` over the spec files → `APPROVED`
- [ ] Every acceptance criterion ticked with its evidence pointer
- [ ] Change committed after both gates; hash recorded in **Commit** below
- [ ] Status set to `done`; advisories (if any) noted below

**Advisories:** none

- **Log:**

**Commit:** none

### Milestone 1 — Definition of done

- [ ] All tickets above are `done`
- [ ] `qoq refactor --decisions auto src/limiter.ts src/limiter.spec.ts src/rate-limit.ts src/rate-limit.spec.ts` → clean
- [ ] Project's full build + full test suite green
- [ ] Both results written into the summary block's **Gate evidence**
- [ ] Milestone archived: full text moved to `2026-08-20-ratelimit.completed.md`, summary block left under `## Completed`
