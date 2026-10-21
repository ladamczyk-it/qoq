export const capitalizeFirstLetter = (name: string): string => {
  return (name.at(0) ?? '').toUpperCase() + name.slice(1);
};

export const omitStartingDotFromPath = (pathString: string): string =>
  pathString.startsWith('./') ? pathString.replace('./', '') : pathString;

export const formatExecutionTime = (durationMs: number): string => {
  const durationSeconds = durationMs / 1000;

  return durationSeconds < 0.1 ? '<0.1s' : `${durationSeconds.toFixed(1)}s`;
};
