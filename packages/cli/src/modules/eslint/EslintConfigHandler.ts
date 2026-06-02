/* eslint-disable @typescript-eslint/no-unsafe-call, sonarjs/cognitive-complexity */
import { existsSync, rmSync, writeFileSync } from 'fs';

import { getPackageInfo } from '@ladamczyk/qoq-utils';
import c from 'picocolors';
import prompts from 'prompts';

import { omitStartingDotFromPath } from '../../helpers/common.ts';
import { formatCode } from '../../helpers/formatCode.ts';
import { EConfigType, QoqConfig } from '../../helpers/types.ts';
import { AbstractConfigHandler } from '../abstract/AbstractConfigHandler.ts';
import { IModulesConfig } from '../types.ts';

import { EModulesEslint, IModuleEslintConfig } from './types.ts';

export class EslintConfigHandler extends AbstractConfigHandler {
  static readonly CONFIG_FILE_PATH = '/eslint.config.js';

  async getPrompts(): Promise<void> {
    if (this.configFileExists()) {
      process.stdout.write(
        c.red(
          `\n 'eslint.config.js' already exists in the project root, config will be overwritten by this setup!\n\n`
        )
      );
    }

    let isTypeSriptInstalled: boolean;

    try {
      isTypeSriptInstalled = !!getPackageInfo('typescript');
    } catch {
      isTypeSriptInstalled = false;
    }

    let isReactInstalled: boolean;

    try {
      isReactInstalled = !!getPackageInfo('react');
    } catch {
      isReactInstalled = false;
    }

    let isJestInstalled: boolean;

    try {
      isJestInstalled = !!getPackageInfo('jest');
    } catch {
      isJestInstalled = false;
    }

    let isVitestInstalled: boolean;

    try {
      isVitestInstalled = !!getPackageInfo('vitest');
    } catch {
      isVitestInstalled = false;
    }

    const { eslintPackages }: { eslintPackages: EModulesEslint[] } = await prompts.prompt([
      {
        type: 'toggle',
        name: 'eslint',
        message: c.reset(`Do You use ${c.green('TypeScript')} in Your project?`),
        initial: isTypeSriptInstalled,
        active: c.green('yes'),
        inactive: c.red('no'),
      },
      {
        type: (prev: boolean) => (prev ? 'multiselect' : null),
        name: 'eslintPackages',
        message: 'What options should we use?',
        choices: [
          {
            title: 'Basic TypeScript only',
            value: EModulesEslint.ESLINT_V9_TS,
            selected: isTypeSriptInstalled && !isReactInstalled,
          },
          {
            title: 'TypeScript + React',
            value: EModulesEslint.ESLINT_V9_TS_REACT,
            selected: isTypeSriptInstalled && isReactInstalled,
          },
          {
            title: 'TypeScript + Jest',
            value: EModulesEslint.ESLINT_V9_TS_JEST,
            selected: isTypeSriptInstalled && isJestInstalled,
          },
          {
            title: 'TypeScript + Vitest',
            value: EModulesEslint.ESLINT_V9_TS_VITEST,
            selected: isTypeSriptInstalled && isVitestInstalled,
          },
        ],
        min: 1,
      },
      {
        type: (prev: boolean) => (!prev ? 'multiselect' : null),
        name: 'eslintPackages',
        message: 'What options should we use?',
        choices: [
          {
            title: 'Basic JavaScript only',
            value: EModulesEslint.ESLINT_V9_JS,
            selected: !isTypeSriptInstalled && !isReactInstalled,
          },
          {
            title: 'JavaScript + React',
            value: EModulesEslint.ESLINT_V9_JS_REACT,
            selected: !isTypeSriptInstalled && isReactInstalled,
          },
          {
            title: 'JavaScript + Jest',
            value: EModulesEslint.ESLINT_V9_JS_JEST,
            selected: !isTypeSriptInstalled && isJestInstalled,
          },
          {
            title: 'JavaScript + Vitest',
            value: EModulesEslint.ESLINT_V9_JS_VITEST,
            selected: !isTypeSriptInstalled && isVitestInstalled,
          },
        ],
        min: 1,
      },
    ]);

    const { srcPath } = this.modulesConfig;

    if (eslintPackages.length > 0) {
      const eslintSrcPath = omitStartingDotFromPath(srcPath);

      this.modulesConfig.modules.eslint = [];

      for (const eslintPackage of eslintPackages) {
        process.stderr.write(c.green(`\nProvide configuration for ${eslintPackage} checks:\n`));

        let initialFiles: string;
        let initialIgnores: string;

        switch (true) {
          case eslintPackage === EModulesEslint.ESLINT_V9_JS:
            initialFiles = `${eslintSrcPath}/**/*.js`;
            initialIgnores = '**/*.spec.js';
            break;

          case eslintPackage === EModulesEslint.ESLINT_V9_JS_REACT:
            initialFiles = `${eslintSrcPath}/**/*.{js,jsx}`;
            initialIgnores = '**/*.spec.js';
            break;

          case eslintPackage === EModulesEslint.ESLINT_V9_TS:
            initialFiles = `${eslintSrcPath}/**/*.{js,ts}`;
            initialIgnores = '**/*.spec.{js,ts}';
            break;

          case eslintPackage === EModulesEslint.ESLINT_V9_TS_REACT:
            initialFiles = `${eslintSrcPath}/**/*.{js,jsx,ts,tsx}`;
            initialIgnores = '**/*.spec.{js,ts}';
            break;

          case [EModulesEslint.ESLINT_V9_JS_JEST, EModulesEslint.ESLINT_V9_JS_VITEST].includes(
            eslintPackage
          ):
            initialFiles = `${eslintSrcPath}/**/*.spec.js`;
            initialIgnores = '';
            break;

          case [EModulesEslint.ESLINT_V9_TS_JEST, EModulesEslint.ESLINT_V9_TS_VITEST].includes(
            eslintPackage
          ):
            initialFiles = `${eslintSrcPath}/**/*.spec.{js,ts}`;
            initialIgnores = '';
            break;

          default:
            initialFiles = '';
            initialIgnores = '';
            break;
        }

        const { files, ignores }: { files: string[]; ignores: string[] } = await prompts.prompt([
          {
            type: 'list',
            name: 'files',
            message: 'Provide files paths (from project root dir), space " " separated',
            separator: ' ',
            initial: initialFiles ?? false,
          },
          {
            type: 'list',
            name: 'ignores',
            message: 'Provide files paths (from project root dir), space " " separated',
            separator: ' ',
            initial: initialIgnores ?? false,
          },
        ]);

        this.modulesConfig.modules.eslint.push({
          template: eslintPackage,
          files: files.filter((entry) => !!entry),
          ignores: ignores.filter((entry) => !!entry),
        });
      }
    }

    if (this.configFileExists()) {
      rmSync(EslintConfigHandler.CONFIG_FILE_PATH);
    }

    writeFileSync(
      EslintConfigHandler.CONFIG_FILE_PATH,
      formatCode(
        this.modulesConfig.configType,
        {
          config: `@ladamczyk/qoq-cli/bin/eslint.config.${this.modulesConfig.configType === EConfigType.ESM ? 'm' : 'c'}js`,
        },
        [],
        'config'
      )
    );

    return super.getPrompts();
  }

  getConfigFromModules(): QoqConfig {
    const {
      modules: { eslint },
    } = this.modulesConfig;

    this.config.eslint = eslint as IModuleEslintConfig[];

    return super.getConfigFromModules();
  }

  getModulesFromConfig(): IModulesConfig {
    this.modulesConfig.modules.eslint = this.config.eslint;

    return super.getModulesFromConfig();
  }

  getPackages(): string[] {
    const templates = (this.modulesConfig.modules.eslint ?? [])
      .filter((config) => config.template && config.template !== EModulesEslint.ESLINT_V9_JS)
      .map((config) => String(config.template));

    this.packages = templates.length > 0 ? templates : [EModulesEslint.ESLINT_V9_JS];

    return super.getPackages();
  }

  protected configFileExists(): boolean {
    return existsSync(EslintConfigHandler.CONFIG_FILE_PATH);
  }
}
