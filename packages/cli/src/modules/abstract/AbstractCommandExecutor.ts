import { CommonSpawnOptions } from 'child_process';

import { EExitCode, executeCommand } from '@ladamczyk/qoq-utils';

import { IExecutorOptions } from '../types.ts';

import { AbstractExecutor } from './AbstractExecutor.ts';

// Base for tools without a JS API (Knip, npm): execute() spawns the tool's
// binary, passing the args getCommandArgs()/prepare() assembled.
export abstract class AbstractCommandExecutor extends AbstractExecutor {
  protected async execute(
    args: string[],
    options: IExecutorOptions,
    stdio: CommonSpawnOptions['stdio'] = 'inherit',
    captureOutput: boolean = false
  ): Promise<string | EExitCode> {
    return executeCommand(this.getCommandName(), args, stdio, captureOutput);
  }
}
