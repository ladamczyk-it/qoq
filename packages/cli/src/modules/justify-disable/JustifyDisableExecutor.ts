import { rmSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { AbstractApiExecutor } from '../abstract/AbstractApiExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import { createJustifyDisableFileProvider } from './createJustifyDisableFileProvider.ts';

import type { TRuleSeverity } from '@ladamczyk/justify-disable';

const SEVERITIES: TRuleSeverity[] = ['error', 'warn', 'off'];

export class JustifyDisableExecutor extends AbstractApiExecutor<string[]> {
  static readonly DEFAULT_SEVERITY: TRuleSeverity = 'off';

  protected getCommandName(): string {
    return 'justify-disable';
  }

  protected prepare(
    _args: string[],
    options: IExecutorOptions,
    files: string[] = []
  ): Promise<string[]> {
    const { justifyDisable } = this.modulesConfig.modules;

    if (!justifyDisable) {
      throw new TerminateExecutorGracefully();
    }

    const severity = justifyDisable.severity ?? JustifyDisableExecutor.DEFAULT_SEVERITY;

    // Without this the package would complain about `missingReason`, a key the user never wrote.
    if (!SEVERITIES.includes(severity)) {
      process.stderr.write(
        c.red(
          `Invalid \`justifyDisable.severity\`: ${JSON.stringify(severity)}. Allowed values: ${SEVERITIES.join(', ')}.\n`
        )
      );
      process.exit(EExitCode.EXCEPTION);

      throw new TerminateExecutorGracefully();
    }

    if (severity === 'off') {
      // Otherwise the qoq skill's digest keeps reading the previous run's report.
      if (options.json) {
        rmSync(`${options.output}/justify-disable-report.json`, { force: true });
      }

      throw new TerminateExecutorGracefully();
    }

    return Promise.resolve(files);
  }

  protected async execute(
    _args: string[],
    options: IExecutorOptions,
    files: string[]
  ): Promise<string | EExitCode> {
    const severity =
      this.modulesConfig.modules.justifyDisable?.severity ??
      JustifyDisableExecutor.DEFAULT_SEVERITY;
    // Imported here, not in prepare(): --warmup returns right after prepare().
    const { lint, format, gitProvider, DEFAULT_EXTENSIONS } =
      await import('@ladamczyk/justify-disable');

    let gitFailed = false;
    const listRepositoryFiles: typeof gitProvider = async (context) => {
      try {
        return await gitProvider(context);
      } catch (error) {
        gitFailed = true;

        throw error;
      }
    };

    let result;

    try {
      result = await lint({
        config: {
          provider: createJustifyDisableFileProvider(this.modulesConfig, {
            listRepositoryFiles,
            extensions: DEFAULT_EXTENSIONS,
          }),
          rules: {
            missingReason: severity,
            expired: severity,
            invalidCondition: severity,
            missingDate: 'off',
          },
        },
        paths: files,
        stats: !!this.modulesConfig.stats,
      });
    } catch (error) {
      if (gitFailed) {
        process.stderr.write(c.yellow('justify-disable needs a git repository; skipping.\n'));

        return EExitCode.OK;
      }

      process.stderr.write(c.red(`${error instanceof Error ? error.message : String(error)}\n`));

      return process.exit(EExitCode.EXCEPTION);
    }

    if (options.json) {
      this.writeReport(result, options.output);
    } else {
      process.stdout.write(format(result));
    }

    return result.passed ? EExitCode.OK : EExitCode.ERROR;
  }
}
