/* eslint-disable @typescript-eslint/no-unsafe-call, sonarjs/cognitive-complexity */
import { getPackageInfo } from '@ladamczyk/qoq-utils';
import c from 'picocolors';
import prompts from 'prompts';

import { omitStartingDotFromPath } from '../../helpers/common.ts';
import { formatCode } from '../../helpers/formatCode.ts';
import { EConfigType, QoqConfig } from '../../helpers/types.ts';
import { AbstractConfigHandler } from '../abstract/AbstractConfigHandler.ts';
import { IModulesConfig } from '../types.ts';

import { EModulesEslint } from './types.ts';

export class EslintConfigHandler extends AbstractConfigHandler {
  static readonly CONFIG_FILE_PATH = '/eslint.config.js';

  async getPrompts(): Promise<void> {
    this.warnIfConfigFileExists();

    let isTypeScriptInstalled: boolean;

    try {
      isTypeScriptInstalled = !!getPackageInfo('typescript');
    } catch {
      isTypeScriptInstalled = false;
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
        initial: isTypeScriptInstalled,
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
            selected: isTypeScriptInstalled && !isReactInstalled,
          },
          {
            title: 'TypeScript + React',
            value: EModulesEslint.ESLINT_V9_TS_REACT,
            selected: isTypeScriptInstalled && isReactInstalled,
          },
          {
            title: 'TypeScript + Jest',
            value: EModulesEslint.ESLINT_V9_TS_JEST,
            selected: isTypeScriptInstalled && isJestInstalled,
          },
          {
            title: 'TypeScript + Vitest',
            value: EModulesEslint.ESLINT_V9_TS_VITEST,
            selected: isTypeScriptInstalled && isVitestInstalled,
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
            selected: !isTypeScriptInstalled && !isReactInstalled,
          },
          {
            title: 'JavaScript + React',
            value: EModulesEslint.ESLINT_V9_JS_REACT,
            selected: !isTypeScriptInstalled && isReactInstalled,
          },
          {
            title: 'JavaScript + Jest',
            value: EModulesEslint.ESLINT_V9_JS_JEST,
            selected: !isTypeScriptInstalled && isJestInstalled,
          },
          {
            title: 'JavaScript + Vitest',
            value: EModulesEslint.ESLINT_V9_JS_VITEST,
            selected: !isTypeScriptInstalled && isVitestInstalled,
          },
        ],
        min: 1,
      },
    ]);

    const { srcPath } = this.modulesConfig;

    if (eslintPackages.length > 0) {
      const eslintSrcPath = omitStartingDotFromPath(srcPath);
      const initialPatternsByTemplate: Partial<
        Record<EModulesEslint, { files: string; ignores: string }>
      > = {
        [EModulesEslint.ESLINT_V9_JS]: {
          files: `${eslintSrcPath}/**/*.js`,
          ignores: '**/*.spec.js',
        },
        [EModulesEslint.ESLINT_V9_JS_REACT]: {
          files: `${eslintSrcPath}/**/*.{js,jsx}`,
          ignores: '**/*.spec.js',
        },
        [EModulesEslint.ESLINT_V9_TS]: {
          files: `${eslintSrcPath}/**/*.{js,ts}`,
          ignores: '**/*.spec.{js,ts}',
        },
        [EModulesEslint.ESLINT_V9_TS_REACT]: {
          files: `${eslintSrcPath}/**/*.{js,jsx,ts,tsx}`,
          ignores: '**/*.spec.{js,ts}',
        },
        [EModulesEslint.ESLINT_V9_JS_JEST]: {
          files: `${eslintSrcPath}/**/*.spec.js`,
          ignores: '',
        },
        [EModulesEslint.ESLINT_V9_JS_VITEST]: {
          files: `${eslintSrcPath}/**/*.spec.js`,
          ignores: '',
        },
        [EModulesEslint.ESLINT_V9_TS_JEST]: {
          files: `${eslintSrcPath}/**/*.spec.{js,ts}`,
          ignores: '',
        },
        [EModulesEslint.ESLINT_V9_TS_VITEST]: {
          files: `${eslintSrcPath}/**/*.spec.{js,ts}`,
          ignores: '',
        },
      };

      this.modulesConfig.modules.eslint = [];

      for (const eslintPackage of eslintPackages) {
        process.stderr.write(c.green(`\nProvide configuration for ${eslintPackage} checks:\n`));

        const { files: initialFiles, ignores: initialIgnores } = initialPatternsByTemplate[
          eslintPackage
        ] ?? { files: '', ignores: '' };

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

    this.writeConfigFile(
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

    if (eslint) {
      this.config.eslint = eslint;
    }

    return super.getConfigFromModules();
  }

  getModulesFromConfig(): IModulesConfig {
    const { eslint } = this.config;

    if (eslint) {
      this.modulesConfig.modules.eslint = eslint;
    }

    return super.getModulesFromConfig();
  }

  getPackages(): string[] {
    const templates = (this.modulesConfig.modules.eslint ?? [])
      .filter(
        (config) => config.template && config.template !== String(EModulesEslint.ESLINT_V9_JS)
      )
      .map((config) => `@ladamczyk/${config.template}`);

    this.packages =
      templates.length > 0 ? templates : [`@ladamczyk/${EModulesEslint.ESLINT_V9_JS}`];

    return super.getPackages();
  }
}
