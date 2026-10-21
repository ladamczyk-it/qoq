import { describe, expect, it } from 'vitest';

import { createLimiter } from '../../rateLimit';

const clock = (start = 1_000) => {
  let time = start;

  return { now: () => time, advance: (ms: number) => (time += ms) };
};

describe('createLimiter', () => {
  it('allows the first `limit` hits and counts remaining down to 0', () => {
    const limiter = createLimiter({ limit: 3, windowMs: 1_000, now: clock().now });

    expect([limiter.hit('a'), limiter.hit('a'), limiter.hit('a')]).toEqual([
      { allowed: true, remaining: 2 },
      { allowed: true, remaining: 1 },
      { allowed: true, remaining: 0 },
    ]);
  });

  it('blocks the hit after the limit with the time left in the window', () => {
    const time = clock();
    const limiter = createLimiter({ limit: 2, windowMs: 1_000, now: time.now });

    limiter.hit('a');
    limiter.hit('a');
    time.advance(400);

    expect(limiter.hit('a')).toEqual({ allowed: false, remaining: 0, retryAfterMs: 600 });
  });

  it('counts keys independently', () => {
    const limiter = createLimiter({ limit: 1, windowMs: 1_000, now: clock().now });

    limiter.hit('a');

    expect(limiter.hit('a').allowed).toBe(false);
    expect(limiter.hit('b')).toEqual({ allowed: true, remaining: 0 });
  });
});
