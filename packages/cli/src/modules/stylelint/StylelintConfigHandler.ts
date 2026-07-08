/* eslint-disable @typescript-eslint/no-unsafe-call */
import c from 'picocolors';
import prompts from 'prompts';

import { formatCode } from '../../helpers/formatCode.ts';
import { EConfigType, QoqConfig } from '../../helpers/types.ts';
import { AbstractConfigHandler } from '../abstract/AbstractConfigHandler.ts';
import { IModulesConfig } from '../types.ts';

import { EModulesStylelint } from './types.ts';

export class StylelintConfigHandler extends AbstractConfigHandler {
  static readonly CONFIG_FILE_PATH = '/stylelint.config.js';

  async getPrompts(): Promise<void> {
    const {
      stylelint,
    }: {
      stylelint: boolean;
    } = await prompts.prompt([
      {
        type: 'toggle',
        name: 'stylelint',
        message: 'Should we include style linting?',
        initial: false,
        active: c.green('yes'),
        inactive: c.red('no'),
      },
    ]);

    if (!stylelint) {
      return super.getPrompts();
    }

    this.warnIfConfigFileExists();

    const {
      stylelintPackage,
      stylelintStrict,
    }: {
      stylelintPackage: EModulesStylelint;
      stylelintStrict: boolean;
    } = await prompts.prompt([
      {
        type: 'select',
        name: 'stylelintPackage',
        message: c.reset(`What options should we use for ${c.green('Stylelint')}?`),
        choices: [
          { title: 'CSS', value: EModulesStylelint.STYLELINT_CSS },
          { title: 'SCSS', value: EModulesStylelint.STYLELINT_SCSS },
        ],
      },
      {
        type: 'toggle',
        name: 'stylelintStrict',
        message: 'Should style linting be strict (fail on warnings)?',
        initial: false,
        active: c.green('yes'),
        inactive: c.red('no'),
      },
    ]);

    this.writeConfigFile(
      formatCode(
        this.modulesConfig.configType,
        {
          config: `@ladamczyk/qoq-cli/bin/stylelint.config.${this.modulesConfig.configType === EConfigType.ESM ? 'm' : 'c'}js`,
        },
        [],
        'config'
      )
    );

    this.modulesConfig.modules.stylelint = {
      strict: stylelintStrict,
      template: stylelintPackage,
    };

    return super.getPrompts();
  }

  getConfigFromModules(): QoqConfig {
    const {
      modules: { stylelint },
    } = this.modulesConfig;

    if (stylelint) {
      const { strict } = stylelint;

      if ('template' in stylelint && stylelint.template) {
        this.config.stylelint = {
          strict: !!strict,
          template: stylelint.template,
        };
      } else if ('pattern' in stylelint && stylelint.pattern) {
        this.config.stylelint = {
          strict: !!strict,
          pattern: stylelint.pattern,
        };
      } else {
        throw new Error('Bad config!');
      }
    }

    return super.getConfigFromModules();
  }

  getModulesFromConfig(): IModulesConfig {
    const { modules } = this.modulesConfig;
    const { stylelint } = this.config;

    if (stylelint) {
      const { strict, ...rest } = stylelint;
      const hasTemplate = 'template' in stylelint && !!stylelint.template;
      const hasPattern = 'pattern' in stylelint && !!stylelint.pattern;

      if (!hasTemplate && !hasPattern) {
        throw new Error('Bad config!');
      }

      modules.stylelint = {
        strict: !!strict,
        ...rest,
      };
    }

    return super.getModulesFromConfig();
  }

  getPackages(): string[] {
    const { stylelint } = this.modulesConfig.modules;
    const template = stylelint && 'template' in stylelint ? stylelint.template : undefined;

    if (template && (Object.values(EModulesStylelint) as string[]).includes(template)) {
      this.packages = [`@ladamczyk/${template}`];
    }

    return super.getPackages();
  }
}
