# Ticket 2.1 — fixed-window rate limiter

## Acceptance criteria

1. The first `limit` hits for a key within one window are allowed, and `remaining` counts down from `limit - 1` to `0`.
2. The next hit for that key within the same window returns `allowed: false` and a `retryAfterMs` equal to the time left in the window.
3. Keys are counted independently — exhausting one key does not affect another.
4. Once `windowMs` has elapsed since a key's window opened, that key's count resets and its next hit is allowed.

## Milestone Contracts (verbatim)

```ts
export interface IHitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}
export interface ILimiter {
  hit(key: string): IHitResult;
}
export interface ILimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}
export declare const createLimiter: (options: ILimiterOptions) => ILimiter;
```
