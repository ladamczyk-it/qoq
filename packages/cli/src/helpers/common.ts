import { existsSync } from 'fs';
import { open } from 'fs/promises';

export const capitalizeFirstLetter = (name: string): string => {
  return (name.at(0) ?? '').toUpperCase() + name.slice(1);
};

export const readIgnorePatterns = async (path: string): Promise<string[]> => {
  if (!existsSync(path)) {
    return [];
  }

  const patterns: string[] = [];
  const file = await open(path);

  for await (const line of file.readLines()) {
    if (!line.startsWith('#') && line !== '') {
      patterns.push(line);
    }
  }

  return patterns;
};

export const omitStartingDotFromPath = (pathString: string): string =>
  pathString.startsWith('./') ? pathString.replace('./', '') : pathString;

export const formatExecutionTime = (durationMs: number): string => {
  const durationSeconds = durationMs / 1000;

  return durationSeconds < 0.1 ? '<0.1s' : `${durationSeconds.toFixed(1)}s`;
};
