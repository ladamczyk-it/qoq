import { readdirSync } from 'fs';

import { EExitCode, getRelativePath, resolveCwdPath } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { AbstractExecutor } from '../abstract/AbstractExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import { JscpdConfigHandler } from './JscpdConfigHandler.ts';
import { IModuleJscpdConfig } from './types.ts';

export class JscpdExecutor extends AbstractExecutor {
  getName(): string {
    return this.getCommandName().toUpperCase();
  }
  protected getCommandName(): string {
    return 'jscpd';
  }

  protected getCommandArgs(): string[] {
    const { srcPath, modules, workspaces } = this.modulesConfig;
    const { format, threshold } = modules.jscpd as IModuleJscpdConfig;

    if (!workspaces) {
      return [
        srcPath,
        '-a',
        '-f',
        format.join(),
        '-t',
        String(threshold ?? JscpdConfigHandler.DEFAULT_THRESHOLD),
      ];
    }

    return [
      ...workspaces.reduce((acc: string[], current) => {
        if (!current.includes('*')) {
          acc.push(current);
        } else {
          const path = `/${current.replaceAll('*', '')}`;

          return acc.concat(
            readdirSync(resolveCwdPath(path), { withFileTypes: true })
              .filter((entry) => entry.isDirectory())
              .map(({ parentPath, name }) => {
                return getRelativePath(`${parentPath}/${name}`);
              })
          );
        }

        return acc;
      }, []),
      '-a',
      '-f',
      format.join(),
      '-t',
      String(threshold ?? JscpdConfigHandler.DEFAULT_THRESHOLD),
    ];
  }

  protected async prepare(args: string[], options: IExecutorOptions): Promise<EExitCode> {
    try {
      if (!options.configHints) {
        args.push('--noTips');
      }

      const { ignore } = this.modulesConfig.modules.jscpd as IModuleJscpdConfig;

      if (ignore && ignore.length > 0) {
        args.push('-i', ignore.join());
      }

      if (options.json) {
        args.push(`--reporters json --output "${options.output}"`);
      }

      return super.prepare(args, { ...options, disableCache: true });
    } catch {
      process.stderr.write(c.red(`Can't load ${this.getName()} package config!\n`));

      return process.exit(EExitCode.EXCEPTION);
    }
  }
}
