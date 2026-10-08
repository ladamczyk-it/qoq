import { existsSync, rmSync, statSync, writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { resolveCliPackagePath } from '../../helpers/paths.ts';
import { AbstractApiExecutor } from '../abstract/AbstractApiExecutor.ts';
import { IExecutorOptions, IModulesConfig } from '../types.ts';

const ONE_DAY_MS = 86400000;

export class NpmExecutor extends AbstractApiExecutor {
  static readonly LOCK_PATH = resolveCliPackagePath('/bin/.npm-outdated-lock');

  // `force` is for a run that named this tool (`qoq npm`): asking for it is
  // asking for fresh data, so the throttle doesn't apply.
  constructor(
    modulesConfig: IModulesConfig,
    silent: boolean = false,
    hideTimer: boolean = false,
    private readonly force: boolean = false
  ) {
    super(modulesConfig, silent, hideTimer);
  }

  getName(): string {
    return 'NPM';
  }

  // The check is advisory: whatever goes wrong (offline, a registry error) warns
  // and returns OK, and the lock file is left unwritten so the next run tries
  // again. `--json` writes @ladamczyk/outdated's schema v1 result verbatim for
  // summarize.mjs; a plain run prints its table of problems.
  protected async execute(_args: string[], options: IExecutorOptions): Promise<EExitCode> {
    const { check, formatTable } = await import('@ladamczyk/outdated');

    try {
      const result = await check();

      if (options.json) {
        this.writeReport(result, options.output);
      } else if (!this.silent) {
        process.stdout.write(formatTable(result, { onlyProblems: true, now: new Date() }));
      }
    } catch (error) {
      if (!this.silent) {
        process.stderr.write(
          c.yellow(
            `Dependency check skipped: ${error instanceof Error ? error.message : String(error)}\n`
          )
        );
      }

      return EExitCode.OK;
    }

    writeFileSync(NpmExecutor.LOCK_PATH, '');

    return EExitCode.OK;
  }

  protected getCommandName(): string {
    return 'npm';
  }

  // The throttle: a lock file younger than `checkOutdatedEvery` days means this
  // run is skipped, which the base's TerminateExecutorGracefully path turns into
  // a clean EExitCode.OK — the same mechanism Stylelint, Prettier and ESLint use
  // to bow out. getCachePath() staying undefined says the tool has no cache.
  protected prepare(_args: string[], options: IExecutorOptions): Promise<void> {
    if (options.warmup || this.force) {
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
