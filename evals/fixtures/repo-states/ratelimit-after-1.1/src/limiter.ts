export interface IRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export interface ILimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

export const createLimiter = ({
  limit,
  windowMs,
  now = Date.now,
}: ILimiterOptions): { hit(key: string): IRateLimitResult } => {
  const windows = new Map<string, { windowStart: number; count: number }>();

  return {
    hit(key: string): IRateLimitResult {
      const time = now();
      const current = windows.get(key);
      const window =
        current && time - current.windowStart < windowMs
          ? current
          : { windowStart: time, count: 0 };

      windows.set(key, window);

      if (window.count >= limit) {
        return { allowed: false, remaining: 0, retryAfterMs: window.windowStart + windowMs - time };
      }

      window.count += 1;

      return { allowed: true, remaining: limit - window.count };
    },
  };
};
