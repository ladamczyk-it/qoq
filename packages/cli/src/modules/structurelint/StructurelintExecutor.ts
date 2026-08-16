import { EExitCode } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { AbstractApiExecutor } from '../abstract/AbstractApiExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import type { ILintOptions, ILintResult } from '@ladamczyk/structurelint';

export class StructurelintExecutor extends AbstractApiExecutor {
  protected getCommandName(): string {
    return 'structurelint';
  }

  protected prepare(): Promise<void> {
    const {
      modules: { structurelint },
    } = this.modulesConfig;

    if (!structurelint) {
      throw new TerminateExecutorGracefully();
    }

    return Promise.resolve();
  }

  protected async execute(_args: string[], options: IExecutorOptions): Promise<string | EExitCode> {
    const {
      modules: { structurelint },
    } = this.modulesConfig;

    // prepare() already guards this; re-narrow here so `structurelint` is defined.
    if (!structurelint) {
      throw new TerminateExecutorGracefully();
    }

    const { structure } = structurelint;

    if (!structure) {
      process.stderr.write(
        c.red(
          'Structurelint is enabled but no `structure` was provided. Add a `structure` array directly under the `structurelint` block in qoq.config.*.\n'
        )
      );

      return process.exit(EExitCode.EXCEPTION);
    }

    const { lint, format } = await import('@ladamczyk/structurelint');

    // `config` skips structurelint's own file discovery: the structure lives in
    // qoq.config.*, not in a structure.config.* of its own. Structurelint's API
    // takes no consent of its own and never prompts: it counts a run only if we
    // hand it one, so QoQ's own answer is what decides.
    const result = await this.lintWithInlineConfig(lint, {
      config: { ...structurelint, structure },
      stats: !!this.modulesConfig.stats,
    });

    if (options.json) {
      this.writeReport(result, options.output);
    } else {
      process.stdout.write(format(result));
    }

    return result.passed ? EExitCode.OK : EExitCode.ERROR;
  }

  // A missing structure root is a config mistake, not a lint failure, and it is
  // the only thing lint() throws for. QoQ reports it the way it reports its own
  // config errors rather than letting the stack out.
  private async lintWithInlineConfig(
    lint: (typeof import('@ladamczyk/structurelint'))['lint'],
    options: ILintOptions
  ): Promise<ILintResult> {
    try {
      return await lint(options);
    } catch (error) {
      process.stderr.write(c.red(`${error instanceof Error ? error.message : String(error)}\n`));

      return process.exit(EExitCode.EXCEPTION);
    }
  }
}
