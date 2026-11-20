import { describe, expect, test } from 'vitest';

import { toResponse } from './rate-limit.js';

describe('toResponse', () => {
  test('maps an allowed result to 200 with the remaining count', () => {
    expect(toResponse({ allowed: true, remaining: 4 })).toStrictEqual({
      status: 200,
      headers: { 'X-RateLimit-Remaining': '4' },
    });
  });

  test('maps a refused result to 429 with no requests remaining', () => {
    expect(toResponse({ allowed: false, remaining: 0, retryAfterMs: 1000 }).status).toBe(429);
    expect(
      toResponse({ allowed: false, remaining: 0, retryAfterMs: 1000 }).headers[
        'X-RateLimit-Remaining'
      ]
    ).toBe('0');
  });

  test('rounds Retry-After up to whole seconds', () => {
    expect(
      toResponse({ allowed: false, remaining: 0, retryAfterMs: 1001 }).headers['Retry-After']
    ).toBe('2');
    expect(
      toResponse({ allowed: false, remaining: 0, retryAfterMs: 1000 }).headers['Retry-After']
    ).toBe('1');
  });

  test('sends no Retry-After on an allowed result', () => {
    expect(toResponse({ allowed: true, remaining: 1 }).headers).not.toHaveProperty('Retry-After');
  });
});
