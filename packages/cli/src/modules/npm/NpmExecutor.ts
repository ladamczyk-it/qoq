import { CommonSpawnOptions } from 'child_process';
import { existsSync, rmSync, statSync, writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import c from 'picocolors';
import { parse, lt, gt } from 'semver';

import { resolveCliPackagePath } from '../../helpers/paths.ts';
import { AbstractExecutor } from '../abstract/AbstractExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import { ENpmWarningType, TNpmOutdatedOutput } from './types.ts';

export class NpmExecutor extends AbstractExecutor {
  static readonly LOCK_PATH = resolveCliPackagePath('/bin/.npm-outdated-lock');

  getName(): string {
    return this.getCommandName().toUpperCase();
  }

  async run(
    options: IExecutorOptions,
    files?: string[],
    stdio?: CommonSpawnOptions['stdio']
  ): Promise<EExitCode>;
  async run(
    options: IExecutorOptions,
    files?: string[],
    stdio?: CommonSpawnOptions['stdio'],
    captureOutput?: boolean
  ): Promise<string>;
  async run(
    options: IExecutorOptions,
    files?: string[],
    stdio: CommonSpawnOptions['stdio'] = 'pipe',
    captureOutput: boolean = true
  ): Promise<string | EExitCode> {
    if (options.warmup) {
      return EExitCode.OK;
    }

    const {
      modules: { npm },
    } = this.modulesConfig;

    const checkAfterDays = npm?.checkOutdatedEvery ?? 1;

    if (checkAfterDays > 0 && existsSync(NpmExecutor.LOCK_PATH)) {
      const { birthtime } = statSync(NpmExecutor.LOCK_PATH);

      if (new Date() < new Date(birthtime.getTime() + 86400000)) {
        return EExitCode.OK;
      }

      rmSync(NpmExecutor.LOCK_PATH);
    }

    process.stdout.write(c.green(`\nChecking npm packages:\n`));

    const result = await super.run(options, files, stdio, captureOutput);
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

        switch (true) {
          case Number(latest?.major) > Number(current?.major):
            acc[ENpmWarningType.MAJOR].push(`${packageName} ${info.current} -> ${info.latest}`);
            break;

          case Number(latest?.minor) > Number(current?.minor):
            acc[ENpmWarningType.MINOR].push(`${packageName} ${info.current} -> ${info.latest}`);
            break;

          default:
            acc[ENpmWarningType.PATCH].push(`${packageName} ${info.current} -> ${info.latest}`);
            break;
        }

        return acc;
      },
      {
        [ENpmWarningType.MAJOR]: [],
        [ENpmWarningType.MINOR]: [],
        [ENpmWarningType.PATCH]: [],
      } as Record<ENpmWarningType, string[]>
    );

    if (!Object.values(npmDictionary).some((warning) => warning.length > 0)) {
      process.stdout.write(c.green(`\nAll dependencies are in latest version :)\n`));
    }

    if (npmDictionary[ENpmWarningType.MAJOR].length > 0) {
      process.stdout.write(
        c.red(`\nConsider update following ${ENpmWarningType.MAJOR} versions:\n`)
      );

      npmDictionary[ENpmWarningType.MAJOR].forEach((packageName) => {
        process.stdout.write(`${packageName}\n`);
      });
    }

    if (npmDictionary[ENpmWarningType.MINOR].length > 0) {
      process.stdout.write(
        c.yellow(`\nConsider update following ${ENpmWarningType.MINOR} versions:\n`)
      );

      npmDictionary[ENpmWarningType.MINOR].forEach((packageName) => {
        process.stdout.write(`${packageName}\n`);
      });
    }

    if (npmDictionary[ENpmWarningType.PATCH].length > 0) {
      process.stdout.write(
        c.cyan(`\nConsider update following ${ENpmWarningType.PATCH} versions:\n`)
      );

      npmDictionary[ENpmWarningType.PATCH].forEach((packageName) => {
        process.stdout.write(`${packageName}\n`);
      });
    }

    writeFileSync(NpmExecutor.LOCK_PATH, '');

    return EExitCode.OK;
  }

  protected getCommandName(): string {
    return 'npm';
  }

  protected getCommandArgs(): string[] {
    return ['outdated', '--json'];
  }

  protected async prepare(args: string[], options: IExecutorOptions): Promise<EExitCode> {
    return super.prepare(args, { ...options, disableCache: true });
  }
}
