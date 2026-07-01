import { writeFileSync } from 'fs';

import { EExitCode } from '@ladamczyk/qoq-utils';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { AbstractExecutor } from '../abstract/AbstractExecutor.ts';
import { IExecutorOptions } from '../types.ts';

export class StructurelintExecutor extends AbstractExecutor {
  protected getCommandName(): string {
    return 'structurelint';
  }

  protected getCommandArgs(): string[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected prepare(_args: string[], _options: IExecutorOptions): Promise<EExitCode> {
    const {
      modules: { structurelint },
    } = this.modulesConfig;

    if (!structurelint) {
      throw new TerminateExecutorGracefully();
    }

    return Promise.resolve(EExitCode.OK);
  }

  protected async execute(_args: string[], options: IExecutorOptions): Promise<string | EExitCode> {
    const {
      modules: { structurelint },
    } = this.modulesConfig;

    // prepare() already guards this; re-narrow here so `path` is a defined string.
    if (!structurelint) {
      throw new TerminateExecutorGracefully();
    }

    const { lint, format } = await import('@ladamczyk/structurelint');
    const result = await lint({ path: structurelint.path });

    if (options.json) {
      writeFileSync(`${options.output}/structurelint-report.json`, JSON.stringify(result));
    } else {
      process.stdout.write(format(result));
    }

    return result.passed ? EExitCode.OK : EExitCode.ERROR;
  }
}
