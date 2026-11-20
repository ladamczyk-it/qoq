import type { IRateLimitResult } from './limiter.js';

export interface IRateLimitResponse {
  status: 200 | 429;
  headers: Record<string, string>;
}

export const toResponse = (result: IRateLimitResult): IRateLimitResponse => {
  const headers: Record<string, string> = { 'X-RateLimit-Remaining': String(result.remaining) };

  if (!result.allowed) {
    headers['Retry-After'] = String(Math.ceil((result.retryAfterMs ?? 0) / 1000));

    return { status: 429, headers };
  }

  return { status: 200, headers };
};
