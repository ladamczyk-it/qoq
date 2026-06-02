import { existsSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';

import { EExitCode, resolveCwdRelativePath } from '@ladamczyk/qoq-utils';
import { flattenDeep } from 'es-toolkit/compat';
import micromatch from 'micromatch';
import c from 'picocolors';

import { capitalizeFirstLetter } from '../../helpers/common.ts';
import { GITIGNORE_FILE_PATH } from '../../helpers/constants.ts';
import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { formatCode } from '../../helpers/formatCode.ts';
import { resolveCliPackagePath, resolveCliRelativePath } from '../../helpers/paths.ts';
import { EConfigType } from '../../helpers/types.ts';
import { AbstractExecutor } from '../abstract/AbstractExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import { EModulesEslint, IModuleEslintConfig } from './types.ts';

export class EslintExecutor extends AbstractExecutor {
  static readonly CACHE_PATH = resolveCliRelativePath('/bin/.eslintcache');

  getName(): string {
    return capitalizeFirstLetter(this.getCommandName());
  }
  protected getCommandName(): string {
    return 'eslint';
  }

  protected getCommandArgs(): string[] {
    return ['--max-warnings', '0'];
  }

  protected async prepare(
    args: string[],
    options: IExecutorOptions,
    files: string[] = []
  ): Promise<EExitCode> {
    try {
      const {
        configType,
        modules,
        configPaths: { eslint: configPath },
      } = this.modulesConfig;
      const configFilePath = resolveCliPackagePath(
        `/bin/eslint.config.${configType === EConfigType.ESM ? 'm' : 'c'}js`
      );

      const imports: Record<string, string> = {
        '{ objectMergeRight }': '@ladamczyk/qoq-utils',
        '{ includeIgnoreFile }': '@eslint/compat',
      };

      const content = (modules?.eslint ?? []).reduce(
        (acc: string[], current: IModuleEslintConfig, index) => {
          const { template, ...rest } = current;

          if (Object.values(EModulesEslint).includes(template as EModulesEslint)) {
            if (configType === EConfigType.ESM) {
              imports[`{ baseConfig as baseConfig${index} }`] = `@ladamczyk/${template}`;
            } else {
              imports[`{ baseConfig: baseConfig${index} }`] = `@ladamczyk/${template}`;
            }

            acc.push(
              `const config${index} = [objectMergeRight(baseConfig${index}, ${JSON.stringify(rest)})]`
            );
          } else {
            acc.push(`const config${index} = [${JSON.stringify(rest)}]`);
          }

          return acc;
        },
        []
      );

      const mergeConfigsInitialArray = existsSync(GITIGNORE_FILE_PATH)
        ? `[includeIgnoreFile('${GITIGNORE_FILE_PATH.replaceAll('\\', '\\\\')}')]`
        : '[]';

      const exports = `${mergeConfigsInitialArray}${(modules?.eslint ?? [])
        .map((_, index) => `.concat(config${index})`)
        .join('')}`;

      writeFileSync(configFilePath, formatCode(configType, imports, content, exports));

      args.push('-c', resolveCwdRelativePath(configPath));

      if (files.length > 0) {
        // eslint-disable-next-line sonarjs/no-dead-store
        let filteredFiles = [...files];

        try {
          const eslintConfig = await import(pathToFileURL(configFilePath).toString());
          const mapCallback = (entry: string) =>
            entry.startsWith('**') || entry.startsWith('./') ? entry : `**/${entry}`;
          const prepareCollection = (patterns: string[] | undefined) => {
            let collection: string[];

            if (patterns) {
              collection = Array.isArray(patterns) ? flattenDeep(patterns) : [patterns];
            } else {
              collection = [];
            }

            return collection.map(mapCallback);
          };

          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const possibleFiles = (eslintConfig.default as IModuleEslintConfig[]).reduce(
            (acc: { files: string[]; ignores: string[] }[], config) =>
              acc.concat([
                {
                  files: prepareCollection(config.files as string[] | undefined),
                  ignores: prepareCollection(config.ignores),
                },
              ]),
            []
          );

          const shouldLintFile = (file: string) =>
            possibleFiles.some(
              ({ files: filesPatterns, ignores: ignoresPatterns }) =>
                micromatch.isMatch(file, filesPatterns) &&
                !micromatch.isMatch(file, ignoresPatterns)
            );

          filteredFiles = files.filter((file) => shouldLintFile(file));
        } catch {
          throw new Error();
        }

        if (filteredFiles.length === 0) {
          throw new TerminateExecutorGracefully();
        }

        args.push('--stdin-filename', ...filteredFiles);
      }

      if (options.fix) {
        args.push('--fix');
      }

      if (options.concurrency !== 'off') {
        args.push(`--concurrency ${options.concurrency}`);
      }

      if (options.json) {
        args.push(`--format json --output-file "${options.output}/eslint-report.json"`);
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
