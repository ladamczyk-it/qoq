import { EExitCode } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

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
      if (e instanceof TerminateExecutorGracefully) {
        throw e;
      }

      process.stderr.write(c.red(`Can't load ${this.getName()} package config!\n`));

      return process.exit(EExitCode.EXCEPTION);
    }
  }
}
