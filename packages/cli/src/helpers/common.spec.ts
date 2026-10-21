import { describe, it, expect } from 'vitest';

import { capitalizeFirstLetter, formatExecutionTime, omitStartingDotFromPath } from './common.ts';

describe('formatExecutionTime', () => {
  it.each([
    [0, '<0.1s'],
    [42, '<0.1s'],
    [99, '<0.1s'],
    [100, '0.1s'],
    [1000, '1.0s'],
    [1549, '1.5s'],
    [65432, '65.4s'],
  ])('should format %sms as %s', (durationMs, expected) => {
    expect(formatExecutionTime(durationMs)).toBe(expected);
  });
});

describe('capitalizeFirstLetter', () => {
  it.each([
    ['hello', 'Hello'],
    ['world', 'World'],
    ['foo-bar', 'Foo-bar'],
    ['FOO-BAR', 'FOO-BAR'],
  ])('should capitalize first letter of %s to %s', (input, expected) => {
    expect(capitalizeFirstLetter(input)).toBe(expected);
  });
});

describe('omitStartingDotFromPath', () => {
  it.each([
    ['./foo/bar', 'foo/bar'],
    ['foo/bar', 'foo/bar'],
  ])('should omit starting dot from path %s to %s', (input, expected) => {
    expect(omitStartingDotFromPath(input)).toBe(expected);
  });
});
