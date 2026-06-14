/* eslint-disable sonarjs/cognitive-complexity */
import { writeFileSync } from 'fs';

import { StylelintConfig } from '@ladamczyk/qoq-stylelint-css';
import { EExitCode, resolveCwdRelativePath } from '@ladamczyk/qoq-utils';
import micromatch from 'micromatch';

import { readIgnorePatterns } from '../../helpers/common.ts';
import { GITIGNORE_FILE_PATH } from '../../helpers/constants.ts';
import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { formatCode } from '../../helpers/formatCode.ts';
import { resolveCliPackagePath, resolveCliRelativePath } from '../../helpers/paths.ts';
import { EConfigType } from '../../helpers/types.ts';
import { AbstractExecutor } from '../abstract/AbstractExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import {
  EModulesStylelint,
  type IModuleStylelintConfigWithPattern,
  type IModuleStylelintConfigWithTemplate,
} from './types.ts';

export class StylelintExecutor extends AbstractExecutor {
  static readonly CACHE_PATH = resolveCliRelativePath('/bin/.stylelintcache');

  protected getCommandName(): string {
    return 'stylelint';
  }

  protected getCommandArgs(): string[] {
    return [];
  }

  protected async prepare(
    args: string[],
    options: IExecutorOptions,
    files: string[] = []
  ): Promise<EExitCode> {
    const {
      srcPath,
      configType,
      modules: { stylelint },
      configPaths: { stylelint: configPath },
    } = this.modulesConfig;

    if (!stylelint) {
      throw new TerminateExecutorGracefully();
    }

    const { strict } = stylelint;
    let rest: StylelintConfig;

    if ((<IModuleStylelintConfigWithPattern>stylelint).pattern) {
      const { pattern, ...other } = <IModuleStylelintConfigWithPattern>stylelint;

      rest = other;

      args.push(`"${pattern}"`);
    } else if ((<IModuleStylelintConfigWithTemplate>stylelint).template) {
      const { template, ...other } = <IModuleStylelintConfigWithTemplate>stylelint;

      rest = other;

      if (template === EModulesStylelint.STYLELINT_SCSS) {
        args.push(`${srcPath}/**/*.{css,scss,sass}`);
      } else {
        args.push(`${srcPath}/**/*.css`);
      }
    } else {
      throw new Error('Bad config!');
    }

    if (!options.disableCache) {
      args.push('--cache-strategy', 'metadata');
    }

    try {
      if (strict) {
        args.push('--max-warnings', '0');
      }

      const configFilePath = resolveCliPackagePath(
        `/bin/stylelint.config.${configType === EConfigType.ESM ? 'm' : 'c'}js`
      );

      const imports: Record<string, string> = {
        '{ objectMergeRight }': '@ladamczyk/qoq-utils',
      };

      const content: string[] = [];

      if ((<IModuleStylelintConfigWithTemplate>stylelint).template) {
        imports[`{ baseConfig }`] =
          `@ladamczyk/${(<IModuleStylelintConfigWithTemplate>stylelint).template}`;

        content.push(`const config = objectMergeRight(baseConfig, ${JSON.stringify(rest)})`);
      } else {
        content.push(`const config = ${JSON.stringify(rest)}`);
      }

      const exports = 'config';

      writeFileSync(configFilePath, formatCode(configType, imports, content, exports));

      args.push('-c', resolveCwdRelativePath(configPath));

      if (files.length > 0) {
        // eslint-disable-next-line sonarjs/no-dead-store
        let filteredFiles = [...files];

        try {
          const ignores = await readIgnorePatterns(GITIGNORE_FILE_PATH);

          filteredFiles = files.filter((file) => !micromatch.isMatch(file, ignores));
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

      if (options.json) {
        args.push(
          `--formatter json --output-file "${resolveCliRelativePath('/bin/report')}/stylelint-report.json"`
        );
      }

      return super.prepare(args, options, files);
    } catch (e) {
      return this.handlePrepareError(e);
    }
  }
}
