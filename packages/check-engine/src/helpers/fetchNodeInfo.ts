import { major } from 'semver';

import { readJsonSync } from './readJson.ts';

import type { LtsInfo } from './types.ts';

interface IDataRow {
  version: string;
  date: string;
  lts: string | false;
  security: boolean;
}

export const fetchNodeInfo = async (path: string): Promise<LtsInfo> => {
  let data: IDataRow[];
  const formatData = (rawData: IDataRow[]): IDataRow[] =>
    rawData
      .filter((row) => row.lts && row.security)
      .toSorted((a: IDataRow, b: IDataRow) => (new Date(a.date) > new Date(b.date) ? 1 : -1));

  try {
    const response = await fetch('https://nodejs.org/download/release/index.json', {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const responseData = (await response.json()) as IDataRow[];

    data = formatData(responseData);
  } catch {
    try {
      data = formatData(readJsonSync<IDataRow[]>(path));
    } catch {
      throw new Error(
        `Can't read 'https://nodejs.org/download/release/index.json' and no '${path}' found in the project root. Pass --no-lts to skip the LTS lookup.`
      );
    }
  }

  const ltsDictionary = data.reduce((acc: Record<number, string>, current: IDataRow) => {
    acc[major(current.version)] ??= current.version;

    return acc;
  }, {});

  const [currentLtsKey, maintainedLtsKey] = Object.keys(ltsDictionary).sort(
    (a: string, b: string) => (Number(a) > Number(b) ? -1 : 1)
  );

  return {
    currentLts: ltsDictionary[Number(currentLtsKey)] ?? '',
    maintainedLts: ltsDictionary[Number(maintainedLtsKey)] ?? '',
  };
};
