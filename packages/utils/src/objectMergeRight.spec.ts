/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';

import { objectMergeRight } from './objectMergeRight';

describe('objectMergeRight', () => {
  it('throws an error if only one object passed', () => {
    expect(() => objectMergeRight({})).toThrow();
  });

  const first = {
    a: 1,
  };

  const second = {
    b: 2,
  };

  const third = {
    c: 3,
  };

  it('merge two objects with no keys collision', () => {
    expect(objectMergeRight<any>(first, second)).toStrictEqual({ a: 1, b: 2 });
  });

  it('merge three objects with no keys collision', () => {
    expect(objectMergeRight<any>(first, second, third)).toStrictEqual({ a: 1, b: 2, c: 3 });
  });

  it('merge objects with keys collision', () => {
    const collision = { a: 2 };

    expect(objectMergeRight<any>(first, collision)).toStrictEqual(collision);
  });

  it('merge objects with mixed keys', () => {
    const collision = { a: 2, b: 3 };

    expect(objectMergeRight<any>(first, collision)).toStrictEqual(collision);
  });

  it('merge objects with unset keys', () => {
    const collision = { a: undefined, b: 2 };

    expect(objectMergeRight<any>(first, collision)).toStrictEqual(second);
  });

  it('merge deep with no collision', () => {
    const deep = { deep: { ...second } };

    expect(objectMergeRight<any>(first, deep)).toStrictEqual({ ...first, ...deep });
  });

  it('merge deep with keys collision', () => {
    const firstDeep = { deep: { ...first } };
    const secondDeep = { deep: { a: 2 } };

    expect(objectMergeRight<any>(firstDeep, secondDeep)).toStrictEqual(secondDeep);
  });

  it('merge deep with unset keys', () => {
    const firstDeep = { deep: { ...first } };
    const secondDeep = { deep: { a: undefined } };

    expect(objectMergeRight<any>(firstDeep, secondDeep)).toStrictEqual({ deep: {} });
  });

  const noop = () => 'noop';

  it('keeps a non-cloneable colliding value as-is', () => {
    const result = objectMergeRight<any>({ a: 1 }, { a: noop });

    expect(result.a).toBe(noop);
  });

  it('keeps a non-cloneable first-only value as-is', () => {
    const result = objectMergeRight<any>({ fn: noop }, { other: 1 });

    expect(result.fn).toBe(noop);
  });

  it('keeps a non-cloneable second-only value as-is', () => {
    const result = objectMergeRight<any>({}, { fn: noop });

    expect(result.fn).toBe(noop);
  });
});
