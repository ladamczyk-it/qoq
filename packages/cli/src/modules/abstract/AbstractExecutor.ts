import { CommonSpawnOptions } from 'child_process';
import { existsSync, rmSync, writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { capitalizeFirstLetter, formatExecutionTime } from '../../helpers/common.ts';
import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { IExecutorOptions, IModulesConfig } from '../types.ts';

interface IExecutor {
  getName: () => string;
  run: (
    options: IExecutorOptions,
    files?: string[],
    stdio?: CommonSpawnOptions['stdio'],
    captureOutput?: boolean
  ) => Promise<string | EExitCode>;
}

// Shared base for every executor: owns construction, the run() orchestration
// (timing, messaging, cache args → prepare → warmup → execute, error handling)
// and the prepare-error handler. The actual execute() — spawning a binary vs.
// driving a JS API — is left to the two specialisations, AbstractCommandExecutor
// and AbstractApiExecutor.
//
// `TContext` is whatever prepare() resolves for execute() to consume; run()
// carries the value between them. It defaults to `void` for the executors that
// need nothing — a tool whose whole input is the args array or modulesConfig.
export abstract class AbstractExecutor<TContext = void> implements IExecutor {
  protected modulesConfig: IModulesConfig;
  protected silent: boolean;
  protected hideTimer: boolean;

  constructor(modulesConfig: IModulesConfig, silent: boolean = false, hideTimer: boolean = false) {
    this.modulesConfig = modulesConfig;
    this.silent = silent;
    this.hideTimer = hideTimer;
  }

  getName(): string {
    return capitalizeFirstLetter(this.getCommandName());
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
    const startTime = performance.now();

    if (!this.silent) {
      process.stdout.write(c.green(`\nRunning ${this.getName()}:\n`));
    }

    const args = [...this.getCommandArgs()];

    try {
      this.applyCacheArgs(args, options);

      const context = await this.prepare(args, options, files);

      if (options.warmup) {
        return EExitCode.OK;
      }

      return await this.execute(args, options, context, stdio, captureOutput);
    } catch (e) {
      if (!(e instanceof TerminateExecutorGracefully)) {
        process.stderr.write('Unknown error!\n');

        process.exit(EExitCode.EXCEPTION);
      }

      return EExitCode.OK;
    } finally {
      if (!this.silent && !this.hideTimer) {
        process.stdout.write(
          `${c.italic(c.gray(consoleTimeName))} ${formatExecutionTime(performance.now() - startTime)}\n`
        );
      }
    }
  }

  // Writes the tool's lean `--json` report to <output>/<tool>-report.json. Lives
  // here rather than on AbstractApiExecutor because `--json` is every executor's
  // concern — the filename convention is what skills/qoq/scripts/summarize.mjs
  // parses, so it is owned in one place.
  protected writeReport(report: unknown, output: string): void {
    writeFileSync(`${output}/${this.getCommandName()}-report.json`, JSON.stringify(report));
  }

  // Where this executor's cache file lives, or undefined for a tool that has no
  // cache of its own (npm, Prettier, the self-check). Declaring the absence is
  // what lets those executors keep the shared prepare() step instead of
  // overriding it wholesale to dodge a cache they never had.
  protected getCachePath(): string | undefined {
    return undefined;
  }

  // Invariant part of run(), not a subclass hook: every cached tool takes the
  // same two CLI args and the same warmup clear. Runs before prepare() so a
  // warmed-up executor regenerates its config against an already-cleared cache.
  private applyCacheArgs(args: string[], options: IExecutorOptions): void {
    const cachePath = this.getCachePath();

    if (options.disableCache || !cachePath) {
      return;
    }

    args.push('--cache', '--cache-location', cachePath);

    if (options.warmup && existsSync(cachePath)) {
      rmSync(cachePath, { recursive: true, force: true });
    }
  }

  // Resolves whatever execute() needs and, for spawned tools, pushes the tool's
  // own args onto `args`. Its return value is handed to execute() by run() —
  // state shared through an instance field instead would make an executor
  // single-use by convention with nothing enforcing it.
  protected abstract prepare(
    args: string[],
    options: IExecutorOptions,
    files?: string[]
  ): Promise<TContext>;

  protected handlePrepareError(error: unknown): never {
    if (error instanceof TerminateExecutorGracefully) {
      throw error;
    }

    const message = error instanceof Error ? error.message : describeValue(error);
    const cause =
      error instanceof Error && error.cause !== undefined
        ? ` Caused by: ${describeValue(error.cause)}`
        : '';

    process.stderr.write(
      c.red(`Can't load ${this.getName()} package config! ${message}${cause}\n`)
    );

    return process.exit(EExitCode.EXCEPTION);
  }

  protected abstract execute(
    args: string[],
    options: IExecutorOptions,
    context: TContext,
    stdio?: CommonSpawnOptions['stdio'],
    captureOutput?: boolean
  ): Promise<string | EExitCode>;

  protected abstract getCommandName(): string;
  protected abstract getCommandArgs(): string[];
}

// An error and its `cause` are both `unknown`, so neither can be interpolated
// directly — a plain object would render as "[object Object]", which is the
// uninformative output handlePrepareError's reporting exists to replace.
const describeValue = (value: unknown): string =>
  value instanceof Error ? `${value.name}: ${value.message}` : JSON.stringify(value);
