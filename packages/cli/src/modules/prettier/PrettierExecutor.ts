import { CommonSpawnOptions } from 'child_process';
import { writeFileSync } from 'fs';

import {
  EExitCode,
  executeCommand,
  resolveCwdPath,
  resolveCwdRelativePath,
} from '@ladamczyk/qoq-utils';
import micromatch from 'micromatch';
import c from 'picocolors';

import { readIgnorePatterns } from '../../helpers/common.ts';
import { GITIGNORE_FILE_PATH } from '../../helpers/constants.ts';
import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { resolveCliRelativePath } from '../../helpers/paths.ts';
import { AbstractExecutor } from '../abstract/AbstractExecutor.ts';
import { IExecutorOptions } from '../types.ts';

export class PrettierExecutor extends AbstractExecutor {
  static readonly CACHE_PATH = resolveCliRelativePath('/bin/.prettiercache');

  protected async execute(
    args: string[],
    options: IExecutorOptions,
    stdio: CommonSpawnOptions['stdio'] = 'inherit',
    captureOutput: boolean = false
  ): Promise<string | EExitCode> {
    if (options.json) {
      const checkIndex = args.indexOf('--check');

      if (checkIndex !== -1) {
        args.splice(checkIndex, 1, '--list-different');
      }

      const output = await executeCommand(this.getCommandName(), args, 'pipe', true);
      const files = output.split('\n').filter(Boolean);

      writeFileSync(`${options.output}/prettier-report.json`, JSON.stringify({ issues: files }));

      return files.length > 0 ? EExitCode.ERROR : EExitCode.OK;
    }

    return executeCommand(this.getCommandName(), args, stdio, captureOutput);
  }

  protected getCommandName(): string {
    return 'prettier';
  }

  protected getCommandArgs(): string[] {
    return ['--ignore-unknown'];
  }

  protected async prepare(
    args: string[],
    options: IExecutorOptions,
    files: string[] = []
  ): Promise<EExitCode> {
    const { disableCache, fix } = options;
    if (!disableCache) {
      args.push('--cache-strategy', 'metadata');
    }

    try {
      const {
        srcPath,
        modules,
        configPaths: { prettier: configPath },
      } = this.modulesConfig;

      args.push('--config', resolveCwdRelativePath(configPath));

      const prettierignorePath = resolveCwdPath('/.prettierignore');
      let sources: string[] = modules?.prettier?.sources ?? [srcPath];

      if (files.length > 0) {
        try {
          const ignores = [
            ...(await readIgnorePatterns(GITIGNORE_FILE_PATH)),
            ...(await readIgnorePatterns(prettierignorePath)),
          ];

          sources = files.filter((file) => !micromatch.isMatch(file, ignores));
        } catch {
          throw new Error();
        }

        if (sources.length === 0) {
          throw new TerminateExecutorGracefully();
        }
      }

      args.push('--check', ...sources);

      if (fix) {
        args.push('--write');
      }

      return super.prepare(args, options, files);
    } catch (e) {
      if (e instanceof TerminateExecutorGracefully) {
        throw e;
      }

      process.stderr.write(c.red(`Can't load ${this.getName()} package config!\n`));

      return process.exit(EExitCode.EXCEPTION);
    }
  }
}
