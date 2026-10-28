import { describe, expect, it } from 'vitest';
import { loadOrder } from './load.js';

describe('loadOrder', () => {
  it('returns the order for an existing id', () => {
    expect(loadOrder('o1')?.id).toBe('o1');
  });

  it('gives nothing back for a missing id', () => {
    expect(loadOrder('nope')).toBeNull();
  });
});
