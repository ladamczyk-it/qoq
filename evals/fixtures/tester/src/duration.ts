/**
 * Formats a duration in milliseconds as `Hh Mm Ss`.
 *
 * - Leading zero units are omitted, inner ones are kept: 61_000 → `1m 1s`, 3_600_000 → `1h 0m 0s`.
 * - Seconds are truncated, never rounded: 1_999 → `1s`, 59_999 → `59s`.
 * - 0 → `0s`.
 * - A negative or non-finite input throws a RangeError.
 */
export const formatDuration = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new RangeError(`formatDuration: invalid duration ${ms}`);
  }

  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};
