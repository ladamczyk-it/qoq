import { CommonSpawnOptions } from 'child_process';
import { existsSync, rmSync } from 'fs';

import { EExitCode, executeCommand } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { IExecutorOptions, IModulesConfig } from '../types.ts';

interface IExecutor {
  getName: () => string;
  run: (options: IExecutorOptions, files?: string[]) => Promise<EExitCode>;
}
export abstract class AbstractExecutor implements IExecutor {
  protected modulesConfig: IModulesConfig;
  protected silent: boolean;
  protected hideTimer: boolean;

  constructor(modulesConfig: IModulesConfig, silent: boolean = false, hideTimer: boolean = false) {
    this.modulesConfig = modulesConfig;
    this.silent = silent;
    this.hideTimer = hideTimer;
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
    stdio: CommonSpawnOptions['stdio'] = 'inherit',
    captureOutput: boolean = false
  ): Promise<string | EExitCode> {
    const consoleTimeName = `${this.getName()} execution time:`;
    console.time(c.italic(c.gray(consoleTimeName)));

    if (!this.silent) {
      process.stdout.write(c.green(`\nRunning ${this.getName()}:\n`));
    }

    const args = [...this.getCommandArgs()];

    try {
      await this.prepare(args, options, files);

      if (options.warmup) {
        return EExitCode.OK;
      }

      return await executeCommand(this.getCommandName(), args, stdio, captureOutput);
    } catch (e) {
      if (!(e instanceof TerminateExecutorGracefully)) {
        process.stderr.write('Unknown error!\n');

        process.exit(EExitCode.EXCEPTION);
      }

      return EExitCode.OK;
    } finally {
      if (!this.silent && !this.hideTimer) {
        console.timeEnd(c.italic(c.gray(consoleTimeName)));
      }
    }
  }

  protected async prepare(
    args: string[],
    options: IExecutorOptions,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    files: string[] = []
  ): Promise<EExitCode> {
    if (!options.disableCache) {
      const cachePath = this.constructor.CACHE_PATH as string | undefined;

      if (!cachePath) {
        throw new Error('No cache path for executor defined!');
      }

      args.push('--cache', '--cache-location', cachePath);

      if (options.warmup && existsSync(cachePath)) {
        rmSync(cachePath, { recursive: true, force: true });
      }
    }

    return Promise.resolve(EExitCode.OK);
  }

  abstract getName(): string;

  protected abstract getCommandName(): string;
  protected abstract getCommandArgs(): string[];
}
