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

export const createLimiter = ({ limit, windowMs, now = Date.now }: ILimiterOptions): ILimiter => {
  const windows = new Map<string, { start: number; count: number }>();

  return {
    hit(key) {
      const time = now();
      let window = windows.get(key);

      if (!window || time - window.start >= windowMs) {
        window = { start: time, count: 0 };
        windows.set(key, window);
      }

      if (window.count >= limit) {
        return { allowed: false, remaining: 0, retryAfterMs: window.start + windowMs - time };
      }

      window.count += 1;

      return { allowed: true, remaining: limit - window.count };
    },
  };
};
