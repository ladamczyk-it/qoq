/* eslint-disable sonarjs/cognitive-complexity */
import { CommonSpawnOptions } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { open } from 'fs/promises';

import {
  EExitCode,
  executeCommand,
  resolveCwdPath,
  resolveCwdRelativePath,
} from '@ladamczyk/qoq-utils';
import micromatch from 'micromatch';
import c from 'picocolors';

import { capitalizeFirstLetter } from '../../helpers/common.ts';
import { GITIGNORE_FILE_PATH } from '../../helpers/constants.ts';
import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { resolveCliRelativePath } from '../../helpers/paths.ts';
import { AbstractExecutor } from '../abstract/AbstractExecutor.ts';
import { IExecutorOptions } from '../types.ts';

export class PrettierExecutor extends AbstractExecutor {
  static readonly CACHE_PATH = resolveCliRelativePath('/bin/.prettiercache');

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
          const ignores: string[] = [];

          if (existsSync(GITIGNORE_FILE_PATH)) {
            const file = await open(GITIGNORE_FILE_PATH);

            for await (const line of file.readLines()) {
              if (!line.startsWith('#') && line !== '') {
                ignores.push(line);
              }
            }
          }

          if (existsSync(prettierignorePath)) {
            const file = await open(prettierignorePath);

            for await (const line of file.readLines()) {
              if (!line.startsWith('#') && line !== '') {
                ignores.push(line);
              }
            }
          }

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
