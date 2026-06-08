export type TObjectType = Record<string, unknown>;

const safeClone = <V>(value: V): V => {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
};

const isMergeableObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const walk = <T extends TObjectType>(first: T, second: Partial<T>): T => {
  const firstObjectKeys = Object.keys(first);

  const mergedObject = firstObjectKeys.reduce<TObjectType>((acc, key) => {
    const hasSecondValue = Object.prototype.hasOwnProperty.call(second, key);

    if (hasSecondValue && second[key] === undefined) {
      return acc;
    }

    const firstValue = first[key];

    if (hasSecondValue) {
      const secondValue = second[key];

      acc[key] =
        isMergeableObject(firstValue) && isMergeableObject(secondValue)
          ? walk(firstValue, secondValue)
          : safeClone(secondValue);
    } else {
      acc[key] = safeClone(firstValue);
    }

    return acc;
  }, {});

  Object.keys(second)
    .filter((key) => !firstObjectKeys.includes(key))
    .forEach((key) => {
      mergedObject[key] = safeClone(second[key]);
    });

  return mergedObject as T;
};

/**
 * Method merges objects and tries to clone them with `structuredClone`
 * Object on the right have precedence in every key, and If key is set to 'undefined'
 * it will be removed from object on the left.
 *
 * @param first input object
 * @param args input objects
 * @returns merged object
 */
export const objectMergeRight = <T extends TObjectType>(first: T, ...args: Partial<T>[]): T => {
  if (args.length < 1) {
    throw new Error('objectMergeRight needs at least two objects as arguments!');
  }

  return args.reduce<T>((merged, next) => walk(merged, next), first);
};
