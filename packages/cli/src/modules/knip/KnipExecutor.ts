import { writeFileSync } from 'fs';

import { getKnipConfig } from '@ladamczyk/qoq-knip';
import { EExitCode, getRelativePath } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { formatCode } from '../../helpers/formatCode.ts';
import { resolveCliPackagePath, resolveCliRelativePath } from '../../helpers/paths.ts';
import { EConfigType } from '../../helpers/types.ts';
import { AbstractCommandExecutor } from '../abstract/AbstractCommandExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import { IModuleKnipConfig } from './types.ts';

export class KnipExecutor extends AbstractCommandExecutor {
  static readonly CACHE_PATH = resolveCliRelativePath('/bin/.knipcache');

  protected getCommandName(): string {
    return 'knip';
  }

  protected getCommandArgs(): string[] {
    return ['--exclude', 'enumMembers'];
  }

  protected async prepare(args: string[], options: IExecutorOptions): Promise<EExitCode> {
    try {
      const {
        srcPath,
        configType,
        workspaces,
        modules: { knip },
      } = this.modulesConfig;
      const { entry, project, ignore, ignoreDependencies, ignoreBinaries } =
        knip as IModuleKnipConfig;
      const configFilePath = resolveCliPackagePath(
        `/bin/knip.config.${configType === EConfigType.ESM ? 'm' : 'c'}js`
      );

      const configForFile = getKnipConfig(
        srcPath,
        entry,
        project,
        ignore,
        ignoreDependencies,
        ignoreBinaries
      );

      if (!workspaces) {
        writeFileSync(
          configFilePath,
          formatCode(this.modulesConfig.configType, {}, [], JSON.stringify(configForFile))
        );
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { entry: srcEntry, project: srcProject, ...rest } = configForFile;

        const newConfigForMonorepo = {
          ...rest,
          workspaces: workspaces.reduce(
            (acc: Record<string, { entry: string[]; project: string[] }>, current: string) => {
              acc[current] = {
                entry,
                project,
              };
              return acc;
            },
            {}
          ),
        };

        writeFileSync(
          configFilePath,
          formatCode(this.modulesConfig.configType, {}, [], JSON.stringify(newConfigForMonorepo))
        );
      }

      args.push('-c', getRelativePath(configFilePath));

      if (!options.configHints) {
        args.push('--no-config-hints');
      }

      if (options.production) {
        args.push('--production');
      }

      if (options.fix) {
        args.push('--fix');
      }

      if (options.json) {
        args.push(`--reporter json > "${options.output}/knip-report.json"`);
      }

      return super.prepare(args, options);
    } catch {
      process.stderr.write(c.red(`Can't load ${this.getName()} package config!\n`));

      return process.exit(EExitCode.EXCEPTION);
    }
  }
}
