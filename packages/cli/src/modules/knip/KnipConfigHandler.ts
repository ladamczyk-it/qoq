/* eslint-disable @typescript-eslint/no-unsafe-call */
import prompts from 'prompts';
import isEqual from 'react-fast-compare';

import { omitStartingDotFromPath } from '../../helpers/common.ts';
import { QoqConfig } from '../../helpers/types.ts';
import { AbstractConfigHandler } from '../abstract/AbstractConfigHandler.ts';
import { getFilesExtensions } from '../helpers.ts';
import { IModulesConfig } from '../types.ts';

export class KnipConfigHandler extends AbstractConfigHandler {
  static readonly DEFAULT_IGNORE = [
    'skills/**',
    'qoq.config.{js,cjs,mjs,ts}',
    'eslint.config.{js,cjs,mjs,ts}',
    'release.config.{js,cjs,mjs,ts}',
    'stylelint.config.{js,cjs,mjs,ts}',
    'vitest.config.{js,cjs,mjs,ts}',
    'structure.config.{js,cjs,mjs,ts}',
  ];
  static readonly DEFAULT_IGNORE_DEPENDENCIES = ['@ladamczyk/*'];
  static readonly DEFAULT_IGNORE_BINARIES = [];
  static readonly DEFAULT_IGNORE_FILES = [];
  static readonly DEFAULT_IGNORE_MEMBERS = [];
  static readonly DEFAULT_IGNORE_UNRESOLVED = [];

  async getPrompts(): Promise<void> {
    const {
      knipEntry,
      knipProject,
      knipIgnore,
      knipIgnoreDependencies,
      knipIgnoreBinaries,
      knipIgnoreFiles,
      knipIgnoreMembers,
      knipIgnoreUnresolved,
    }: {
      knipEntry: string[];
      knipProject: string[];
      knipIgnore: string[];
      knipIgnoreDependencies: string[];
      knipIgnoreBinaries: string[];
      knipIgnoreFiles: string[];
      knipIgnoreMembers: string[];
      knipIgnoreUnresolved: string[];
    } = await prompts.prompt([
      {
        type: 'list',
        name: 'knipEntry',
        message: 'Provide entry (initially autodetected from previous config), space " " separated',
        separator: ' ',
        initial: this.getDefaultEntry().join(' '),
      },
      {
        type: 'list',
        name: 'knipProject',
        message:
          'Provide project (initially autodetected from previous config), space " " separated',
        separator: ' ',
        initial: this.getDefaultProject().join(' '),
      },
      {
        type: 'list',
        name: 'knipIgnore',
        message:
          'Provide ignore (initially autodetected from previous config), space " " separated',
        separator: ' ',
      },
      {
        type: 'list',
        name: 'knipIgnoreDependencies',
        message:
          'Provide ignoreDependencies (initially autodetected from previous config), space " " separated',
        separator: ' ',
      },
      {
        type: 'list',
        name: 'knipIgnoreBinaries',
        message:
          'Provide ignoreBinaries (initially autodetected from previous config), space " " separated',
        separator: ' ',
      },
      {
        type: 'list',
        name: 'knipIgnoreFiles',
        message:
          'Provide ignoreFiles (initially autodetected from previous config), space " " separated',
        separator: ' ',
      },
      {
        type: 'list',
        name: 'knipIgnoreMembers',
        message:
          'Provide ignoreMembers (initially autodetected from previous config), space " " separated',
        separator: ' ',
      },
      {
        type: 'list',
        name: 'knipIgnoreUnresolved',
        message:
          'Provide ignoreUnresolved (initially autodetected from previous config), space " " separated',
        separator: ' ',
      },
    ]);

    this.modulesConfig.modules.knip = {
      entry: knipEntry.filter((entry) => !!entry).map(omitStartingDotFromPath),
      project: knipProject.filter((entry) => !!entry).map(omitStartingDotFromPath),
      ignore: knipIgnore.filter((entry) => !!entry).map(omitStartingDotFromPath),
      ignoreDependencies: knipIgnoreDependencies.filter((entry) => !!entry),
      ignoreBinaries: knipIgnoreBinaries.filter((entry) => !!entry),
      ignoreFiles: knipIgnoreFiles.filter((entry) => !!entry).map(omitStartingDotFromPath),
      ignoreMembers: knipIgnoreMembers.filter((entry) => !!entry),
      ignoreUnresolved: knipIgnoreUnresolved.filter((entry) => !!entry),
    };

    return super.getPrompts();
  }

  getConfigFromModules(): QoqConfig {
    const {
      modules: { knip },
    } = this.modulesConfig;

    this.config.knip = {};

    this.assignKnipFieldIfCustom('entry', knip?.entry, this.getDefaultEntry(), false);
    this.assignKnipFieldIfCustom('project', knip?.project, this.getDefaultProject(), false);
    this.assignKnipFieldIfCustom('ignore', knip?.ignore, KnipConfigHandler.DEFAULT_IGNORE, true);
    this.assignKnipFieldIfCustom(
      'ignoreDependencies',
      knip?.ignoreDependencies,
      KnipConfigHandler.DEFAULT_IGNORE_DEPENDENCIES,
      true
    );
    this.assignKnipFieldIfCustom(
      'ignoreBinaries',
      knip?.ignoreBinaries,
      KnipConfigHandler.DEFAULT_IGNORE_BINARIES,
      true
    );
    this.assignKnipFieldIfCustom(
      'ignoreFiles',
      knip?.ignoreFiles,
      KnipConfigHandler.DEFAULT_IGNORE_FILES,
      true
    );
    this.assignKnipFieldIfCustom(
      'ignoreMembers',
      knip?.ignoreMembers,
      KnipConfigHandler.DEFAULT_IGNORE_MEMBERS,
      true
    );
    this.assignKnipFieldIfCustom(
      'ignoreUnresolved',
      knip?.ignoreUnresolved,
      KnipConfigHandler.DEFAULT_IGNORE_UNRESOLVED,
      true
    );

    if (Object.keys(this.config.knip).length === 0) {
      delete this.config.knip;
    }

    return super.getConfigFromModules();
  }

  private readonly assignKnipFieldIfCustom = (
    key: keyof NonNullable<QoqConfig['knip']>,
    value: string[] | undefined,
    defaultValue: string[],
    requireNonEmpty: boolean
  ): void => {
    if (value && (!requireNonEmpty || value.length > 0) && !isEqual(value, defaultValue)) {
      this.config.knip![key] = value;
    }
  };

  getModulesFromConfig(): IModulesConfig {
    this.modulesConfig.modules.knip = {
      entry: this.config.knip?.entry ?? this.getDefaultEntry(),
      project: this.config.knip?.project ?? this.getDefaultProject(),
      ignore: this.config.knip?.ignore
        ? [...KnipConfigHandler.DEFAULT_IGNORE, ...this.config.knip.ignore]
        : KnipConfigHandler.DEFAULT_IGNORE,
      ignoreDependencies: this.config.knip?.ignoreDependencies
        ? [...KnipConfigHandler.DEFAULT_IGNORE_DEPENDENCIES, ...this.config.knip.ignoreDependencies]
        : KnipConfigHandler.DEFAULT_IGNORE_DEPENDENCIES,
      ignoreBinaries: this.config.knip?.ignoreBinaries
        ? [...KnipConfigHandler.DEFAULT_IGNORE_BINARIES, ...this.config.knip.ignoreBinaries]
        : KnipConfigHandler.DEFAULT_IGNORE_BINARIES,
      ignoreFiles: this.config.knip?.ignoreFiles
        ? [...KnipConfigHandler.DEFAULT_IGNORE_FILES, ...this.config.knip.ignoreFiles]
        : KnipConfigHandler.DEFAULT_IGNORE_FILES,
      ignoreMembers: this.config.knip?.ignoreMembers
        ? [...KnipConfigHandler.DEFAULT_IGNORE_MEMBERS, ...this.config.knip.ignoreMembers]
        : KnipConfigHandler.DEFAULT_IGNORE_MEMBERS,
      ignoreUnresolved: this.config.knip?.ignoreUnresolved
        ? [...KnipConfigHandler.DEFAULT_IGNORE_UNRESOLVED, ...this.config.knip.ignoreUnresolved]
        : KnipConfigHandler.DEFAULT_IGNORE_UNRESOLVED,
    };

    return super.getModulesFromConfig();
  }

  getPackages(): string[] {
    this.packages = ['@ladamczyk/qoq-knip'];

    return super.getPackages();
  }

  protected getDefaultEntry = (): string[] => {
    const { srcPath, modules } = this.modulesConfig;
    const pathString = omitStartingDotFromPath(srcPath);

    return [`${pathString}/{index,cli,main,root}.{${getFilesExtensions(modules).join()}}`];
  };

  protected getDefaultProject = (): string[] => {
    const { srcPath, modules } = this.modulesConfig;
    const pathString = omitStartingDotFromPath(srcPath);

    return [`${pathString}/**/*.{${getFilesExtensions(modules).join()}}`];
  };
}
