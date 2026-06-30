import { existsSync, rmSync, writeFileSync } from 'fs';

import { EExitCode, executeCommand, resolveCwdRelativePath } from '@ladamczyk/qoq-utils';
import { cosmiconfig } from 'cosmiconfig';
import c from 'picocolors';
import prompts from 'prompts';

import { formatCode } from '../helpers/formatCode.ts';
import { installPackages } from '../helpers/packages.ts';
import { QoqConfig } from '../helpers/types.ts';

import { AbstractConfigHandler } from './abstract/AbstractConfigHandler.ts';
import { BasicConfigHandler } from './basic/BasicConfigHandler.ts';
import { BasicExecutor } from './basic/BasicExecutor.ts';
import { EslintConfigHandler } from './eslint/EslintConfigHandler.ts';
import { EslintExecutor } from './eslint/EslintExecutor.ts';
import { JscpdConfigHandler } from './jscpd/JscpdConfigHandler.ts';
import { JscpdExecutor } from './jscpd/JscpdExecutor.ts';
import { KnipConfigHandler } from './knip/KnipConfigHandler.ts';
import { KnipExecutor } from './knip/KnipExecutor.ts';
import { NpmConfigHandler } from './npm/NpmConfigHandler.ts';
import { NpmExecutor } from './npm/NpmExecutor.ts';
import { PrettierConfigHandler } from './prettier/PrettierConfigHandler.ts';
import { PrettierExecutor } from './prettier/PrettierExecutor.ts';
import { SkillslintConfigHandler } from './skillslint/SkillslintConfigHandler.ts';
import { SkillslintExecutor } from './skillslint/SkillslintExecutor.ts';
import { StylelintConfigHandler } from './stylelint/StylelintConfigHandler.ts';
import { StylelintExecutor } from './stylelint/StylelintExecutor.ts';
import { IExecutorOptions, IModulesConfig } from './types.ts';

const moduleName = 'qoq';
const searchPlaces = [
  `${moduleName}.config.js`,
  `${moduleName}.config.cjs`,
  `${moduleName}.config.mjs`,
  `${moduleName}.config.ts`,
];

const getHandlerBySequence = (
  modulesConfig: IModulesConfig,
  config: QoqConfig
): AbstractConfigHandler => {
  const basicConfigHandler = new BasicConfigHandler(modulesConfig, config);
  const npmConfigHandler = new NpmConfigHandler(modulesConfig, config);
  const prettierConfigHandler = new PrettierConfigHandler(modulesConfig, config);
  const eslintConfigHandler = new EslintConfigHandler(modulesConfig, config);
  const jscpdConfigHandler = new JscpdConfigHandler(modulesConfig, config);
  const knipConfigHandler = new KnipConfigHandler(modulesConfig, config);
  const stylelintConfigHandler = new StylelintConfigHandler(modulesConfig, config);
  const skillslintConfigHandler = new SkillslintConfigHandler(modulesConfig, config);

  basicConfigHandler
    .setNext(npmConfigHandler)
    .setNext(knipConfigHandler)
    .setNext(prettierConfigHandler)
    .setNext(eslintConfigHandler)
    .setNext(jscpdConfigHandler)
    .setNext(stylelintConfigHandler)
    .setNext(skillslintConfigHandler);

  return basicConfigHandler;
};

const getModulesFromConfig = (
  config: QoqConfig,
  workspaces: IModulesConfig['workspaces']
): IModulesConfig => {
  const modulesConfig = { modules: {}, workspaces } as IModulesConfig;
  const resolved = getHandlerBySequence(modulesConfig, config).getModulesFromConfig();

  // Keep the raw user config around so the BasicExecutor health check can compare
  // it against the defaults the handlers just merged in.
  resolved.rawConfig = config;

  return resolved;
};

export const initConfig = async (
  workspaces: IModulesConfig['workspaces'],
  skipWarmup: boolean = false
): Promise<IModulesConfig> => {
  const modulesConfig = { modules: {}, workspaces } as IModulesConfig;
  const config = {} as QoqConfig;

  await getHandlerBySequence(modulesConfig, config).getPrompts();

  searchPlaces.forEach((filename) => {
    const filepath = resolveCwdRelativePath(`/${filename}`);
    if (existsSync(filepath)) {
      rmSync(filepath);
    }
  });

  const configFromModules = getHandlerBySequence(modulesConfig, config).getConfigFromModules();

  writeFileSync(
    resolveCwdRelativePath(`/${moduleName}.config.js`),
    formatCode(modulesConfig.configType, {}, [], JSON.stringify(configFromModules))
  );

  const packages = getHandlerBySequence(modulesConfig, config).getPackages();

  await installPackages(packages);

  if (!skipWarmup) {
    await executeCommand('qoq', ['--warmup']);
  }

  return modulesConfig;
};

export const getConfig = async (
  workspaces: IModulesConfig['workspaces'],
  skipInit: boolean = false
): Promise<IModulesConfig> => {
  const qoqConfig = await cosmiconfig(moduleName, {
    searchStrategy: 'project',
    searchPlaces,
  }).search();

  if (!skipInit && !qoqConfig) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const { config } = await prompts.prompt({
      type: 'toggle',
      name: 'config',
      message: `No QoQ config found, do You want to run setup now?`,
      initial: true,
      active: c.green('yes'),
      inactive: c.red('no'),
    });

    if (!config) {
      process.stderr.write('Running with defaults\n');

      return getModulesFromConfig({}, workspaces);
    }

    return initConfig(workspaces, true);
  }

  return getModulesFromConfig(qoqConfig?.config as QoqConfig, workspaces);
};

export const execute = async (
  modulesConfig: IModulesConfig,
  options: IExecutorOptions,
  files?: string[],
  tools?: string[]
): Promise<void> => {
  const {
    silent,
    warmup,
    skipNpm,
    skipPrettier,
    skipJscpd,
    skipKnip,
    skipEslint,
    skipStylelint,
    skipSkillslint,
  } = options;

  const hideMessages = !!silent || !!warmup;
  const shouldRun = (name: string) => !tools || tools.includes(name);

  const consoleTimeName = `Total execution time:`;
  console.time(c.italic(c.gray(consoleTimeName)));

  const npmExecutor = new NpmExecutor(modulesConfig, true);
  const knipExecutor = new KnipExecutor(modulesConfig, hideMessages);
  const prettierExecutor = new PrettierExecutor(modulesConfig, hideMessages);
  const jscpdExecutor = new JscpdExecutor(modulesConfig, hideMessages, true);
  const eslintExecutor = new EslintExecutor(modulesConfig, hideMessages);
  const stylelintExecutor = new StylelintExecutor(modulesConfig, hideMessages);
  const skillslintExecutor = new SkillslintExecutor(modulesConfig, hideMessages);
  const basicExecutor = new BasicExecutor(modulesConfig, hideMessages);

  const responses: Record<string, EExitCode> = {
    [npmExecutor.getName()]: EExitCode.OK,
    [knipExecutor.getName()]: EExitCode.OK,
    [prettierExecutor.getName()]: EExitCode.OK,
    [jscpdExecutor.getName()]: EExitCode.OK,
    [eslintExecutor.getName()]: EExitCode.OK,
    [stylelintExecutor.getName()]: EExitCode.OK,
    [skillslintExecutor.getName()]: EExitCode.OK,
    [basicExecutor.getName()]: EExitCode.OK,
  };

  if (!skipNpm && shouldRun('npm')) {
    responses[npmExecutor.getName()] = await npmExecutor.run(options, files, 'pipe');
  }

  if (!skipKnip && shouldRun('knip')) {
    responses[knipExecutor.getName()] = await knipExecutor.run(options, files);
  }

  if (!skipPrettier && shouldRun('prettier')) {
    responses[prettierExecutor.getName()] = await prettierExecutor.run(options, files);
  }

  if (!skipJscpd && shouldRun('jscpd')) {
    responses[jscpdExecutor.getName()] = await jscpdExecutor.run(options, files);
  }

  if (!skipEslint && shouldRun('eslint')) {
    responses[eslintExecutor.getName()] = await eslintExecutor.run(options, files);
  }

  if (!skipStylelint && modulesConfig.modules.stylelint && shouldRun('stylelint')) {
    responses[stylelintExecutor.getName()] = await stylelintExecutor.run(options, files);
  }

  if (!skipSkillslint && modulesConfig.modules.skillslint && shouldRun('skillslint')) {
    responses[skillslintExecutor.getName()] = await skillslintExecutor.run(options, files);
  }

  responses[basicExecutor.getName()] = await basicExecutor.run(options, files);

  Object.keys(responses)
    .filter((key) => responses[key] !== EExitCode.OK)
    .forEach((key) => {
      process.exitCode = EExitCode.ERROR;

      process.stderr.write(c.red(`\nQoQ found some ${key} errors!\n\n`));
    });

  if (!hideMessages) {
    process.stdout.write('\n-------------------------\n\n');

    console.timeEnd(c.italic(c.gray(consoleTimeName)));
  }
};
