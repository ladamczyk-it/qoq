import { major } from 'semver';

import { readJsonSync } from './readJson.ts';

interface IDataRow {
  version: string;
  date: string;
  lts: string | false;
  security: boolean;
}

export const fetchNodeInfo = async (
  path: string
): Promise<{ currentLts: string; maintainedLts: string }> => {
  let data: IDataRow[];
  const formatData = (rawData: IDataRow[]): IDataRow[] =>
    rawData
      .filter((row) => row.lts && row.security)
      .toSorted((a: IDataRow, b: IDataRow) => (new Date(a.date) > new Date(b.date) ? 1 : -1));

  try {
    const response = await fetch('https://nodejs.org/download/release/index.json');
    const responseData = (await response.json()) as IDataRow[];

    data = formatData(responseData);
  } catch {
    try {
      data = formatData(readJsonSync<IDataRow[]>(path));
    } catch {
      throw new Error(
        "Can't read 'https://nodejs.org/download/release/index.json' + no 'node.json' present in root!"
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
