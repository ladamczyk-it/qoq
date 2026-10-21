import { describe, expect, test } from 'vitest';

import { createLimiter } from './limiter.js';

const setup = () => {
  let time = 1_000;
  const limiter = createLimiter({ limit: 3, windowMs: 60_000, now: () => time });

  return { limiter, advance: (ms: number) => (time += ms) };
};

describe('createLimiter', () => {
  test('allows the first limit hits and counts remaining down to 0', () => {
    const { limiter } = setup();

    expect([limiter.hit('a'), limiter.hit('a'), limiter.hit('a')]).toStrictEqual([
      { allowed: true, remaining: 2 },
      { allowed: true, remaining: 1 },
      { allowed: true, remaining: 0 },
    ]);
  });

  test('refuses the next hit with the time left in the window', () => {
    const { limiter, advance } = setup();

    limiter.hit('a');
    limiter.hit('a');
    limiter.hit('a');
    advance(15_000);

    expect(limiter.hit('a')).toStrictEqual({ allowed: false, remaining: 0, retryAfterMs: 45_000 });
  });

  test('counts keys independently', () => {
    const { limiter } = setup();

    limiter.hit('a');
    limiter.hit('a');
    limiter.hit('a');

    expect(limiter.hit('b')).toStrictEqual({ allowed: true, remaining: 2 });
  });

  test('resets a key once windowMs has elapsed', () => {
    const { limiter, advance } = setup();

    limiter.hit('a');
    limiter.hit('a');
    limiter.hit('a');
    advance(60_000);

    expect(limiter.hit('a')).toStrictEqual({ allowed: true, remaining: 2 });
  });
});
