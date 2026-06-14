import { EExitCode } from '@ladamczyk/qoq-utils';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { AbstractExecutor } from '../abstract/AbstractExecutor.ts';
import { IExecutorOptions } from '../types.ts';

export class SkillslintExecutor extends AbstractExecutor {
  protected getCommandName(): string {
    return 'skillslint';
  }

  protected getCommandArgs(): string[] {
    return [];
  }

  protected async prepare(args: string[], options: IExecutorOptions): Promise<EExitCode> {
    const {
      modules: { skillslint },
    } = this.modulesConfig;

    if (!skillslint) {
      throw new TerminateExecutorGracefully();
    }

    const { path } = skillslint;

    args.push('--path', path);

    const { fix } = options;

    try {
      if (fix) {
        args.push('--fix');
      }

      return super.prepare(args, { ...options, disableCache: true });
    } catch (e) {
      return this.handlePrepareError(e);
    }
  }
}
