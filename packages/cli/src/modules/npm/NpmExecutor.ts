import { existsSync, rmSync, statSync, writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import c from 'picocolors';
import { parse, lt, gt } from 'semver';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { resolveCliPackagePath } from '../../helpers/paths.ts';
import { AbstractCommandExecutor } from '../abstract/AbstractCommandExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import { ENpmWarningType, TNpmOutdatedEntry, TNpmOutdatedOutput } from './types.ts';

const ONE_DAY_MS = 86400000;

export class NpmExecutor extends AbstractCommandExecutor {
  static readonly LOCK_PATH = resolveCliPackagePath('/bin/.npm-outdated-lock');

  getName(): string {
    return this.getCommandName().toUpperCase();
  }

  // `npm outdated` always needs its JSON captured, whatever stdio the caller
  // asked for, so the spawn arguments are fixed here rather than plumbed through
  // run(). Overriding run() itself is what this used to do — the base's
  // TerminateExecutorGracefully path (see prepare()) covers the skip instead.
  protected async execute(args: string[], options: IExecutorOptions): Promise<EExitCode> {
    const result = (await super.execute(args, options, undefined, 'pipe', true)) as string;
    const jsonResult = JSON.parse(result) as TNpmOutdatedOutput;

    const npmDictionary = Object.keys(jsonResult).reduce(
      (acc, packageName: string) => {
        let info = jsonResult[packageName];

        if (!info) {
          return acc;
        }

        if (Array.isArray(info)) {
          info = info.reduce(
            (newInfo, innerInfo) => {
              if (!newInfo.current || lt(innerInfo.current, newInfo.current)) {
                newInfo.current = innerInfo.current;
              }

              if (gt(innerInfo.latest, newInfo.latest)) {
                newInfo.latest = innerInfo.latest;
              }

              return newInfo;
            },
            { current: '', latest: '0.0.0' }
          );
        }

        const current = parse(info.current);
        const latest = parse(info.latest);
        const entry = { name: packageName, current: info.current, latest: info.latest };

        if (Number(latest?.major) > Number(current?.major)) {
          acc[ENpmWarningType.MAJOR].push(entry);
        } else if (Number(latest?.minor) > Number(current?.minor)) {
          acc[ENpmWarningType.MINOR].push(entry);
        } else {
          acc[ENpmWarningType.PATCH].push(entry);
        }

        return acc;
      },
      {
        [ENpmWarningType.MAJOR]: [],
        [ENpmWarningType.MINOR]: [],
        [ENpmWarningType.PATCH]: [],
      } as Record<ENpmWarningType, TNpmOutdatedEntry[]>
    );

    if (!this.silent) {
      this.printOutdated(npmDictionary);
    }

    if (options.json) {
      this.writeReport(
        {
          major: npmDictionary[ENpmWarningType.MAJOR],
          minor: npmDictionary[ENpmWarningType.MINOR],
          patch: npmDictionary[ENpmWarningType.PATCH],
        },
        options.output
      );
    }

    writeFileSync(NpmExecutor.LOCK_PATH, '');

    return EExitCode.OK;
  }

  private printOutdated(npmDictionary: Record<ENpmWarningType, TNpmOutdatedEntry[]>): void {
    if (!Object.values(npmDictionary).some((warning) => warning.length > 0)) {
      process.stdout.write(c.green(`\nAll dependencies are in latest version :)\n`));

      return;
    }

    const colors = {
      [ENpmWarningType.MAJOR]: c.red,
      [ENpmWarningType.MINOR]: c.yellow,
      [ENpmWarningType.PATCH]: c.cyan,
    };

    Object.values(ENpmWarningType)
      .filter((type) => npmDictionary[type].length > 0)
      .forEach((type) => {
        process.stdout.write(colors[type](`\nConsider update following ${type} versions:\n`));

        npmDictionary[type].forEach(({ name, current, latest }) => {
          process.stdout.write(`${name} ${current} -> ${latest}\n`);
        });
      });
  }

  protected getCommandName(): string {
    return 'npm';
  }

  protected getCommandArgs(): string[] {
    return ['outdated', '--json'];
  }

  // npm outdated has no cache of its own — getCachePath() staying undefined is
  // what says so. What prepare() does own is the throttle: a lock file younger
  // than `checkOutdatedEvery` days means this run is skipped, which the base's
  // TerminateExecutorGracefully path turns into a clean EExitCode.OK — the same
  // mechanism Stylelint, Prettier and ESLint use to bow out.
  protected prepare(_args: string[], options: IExecutorOptions): Promise<void> {
    if (options.warmup) {
      return Promise.resolve();
    }

    const {
      modules: { npm },
    } = this.modulesConfig;

    const checkAfterDays = npm?.checkOutdatedEvery ?? 1;

    if (checkAfterDays > 0 && existsSync(NpmExecutor.LOCK_PATH)) {
      const { birthtime } = statSync(NpmExecutor.LOCK_PATH);

      if (new Date() < new Date(birthtime.getTime() + checkAfterDays * ONE_DAY_MS)) {
        throw new TerminateExecutorGracefully();
      }

      rmSync(NpmExecutor.LOCK_PATH);
    }

    return Promise.resolve();
  }
}
