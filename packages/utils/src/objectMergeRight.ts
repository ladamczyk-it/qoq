export type TObjectType = object & { length?: never };

const safeClone = <V>(value: V): V => {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
};

const walk = <T extends TObjectType>(first: T, second: Partial<T>) => {
  const firstObjectKeys = Object.keys(first);

  const mergedObject = firstObjectKeys.reduce((acc, key: string) => {
    if (Object.prototype.hasOwnProperty.call(second, key) && second[key] === undefined) {
      return acc;
    }

    const firstValue = first[key];

    if (Object.prototype.hasOwnProperty.call(second, key)) {
      const secondValue = second[key];

      if (
        typeof firstValue === 'object' &&
        !Array.isArray(firstValue) &&
        typeof secondValue === 'object' &&
        !Array.isArray(secondValue)
      ) {
        acc[key] = walk(firstValue as TObjectType, secondValue as TObjectType);
      } else {
        acc[key] = safeClone(secondValue);
      }
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

  const [second, third, ...rest] = args;
  const mergedObject = walk<T>(first, second);

  if (third) {
    return objectMergeRight<T>(mergedObject, third, ...rest);
  }

  return mergedObject;
};
