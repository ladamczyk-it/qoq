import { existsSync, rmSync, writeFileSync } from 'fs';

import { EExitCode, executeCommand, resolveCwdRelativePath } from '@ladamczyk/qoq-utils';
import { cosmiconfig } from 'cosmiconfig';
import c from 'picocolors';
import prompts from 'prompts';

import { formatExecutionTime } from '../helpers/common.ts';
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
import { StructurelintConfigHandler } from './structurelint/StructurelintConfigHandler.ts';
import { StructurelintExecutor } from './structurelint/StructurelintExecutor.ts';
import { StylelintConfigHandler } from './stylelint/StylelintConfigHandler.ts';
import { StylelintExecutor } from './stylelint/StylelintExecutor.ts';
import { IExecutorOptions, IModulesConfig } from './types.ts';

// Only the public half of AbstractExecutor, so one array can hold executors whose
// prepare()/execute() contexts are all different types.
interface IExecutorEntry {
  name: string;
  executor: {
    getName: () => string;
    run: (options: IExecutorOptions, files?: string[]) => Promise<EExitCode>;
  };
  skip?: boolean | undefined;
  moduleKey?: keyof IModulesConfig['modules'];
}

const moduleName = 'qoq';
const searchPlaces = [
  `${moduleName}.config.ts`,
  `${moduleName}.config.js`,
  `${moduleName}.config.cjs`,
  `${moduleName}.config.mjs`,
];

// Every handler writes into the same `modulesConfig` / `config` pair it is
// handed; the order below is the order those writes happen in, and the array is
// built once per flow so a handler's state survives across the three passes.
const getHandlersBySequence = (
  modulesConfig: IModulesConfig,
  config: QoqConfig
): AbstractConfigHandler[] => [
  new BasicConfigHandler(modulesConfig, config),
  new NpmConfigHandler(modulesConfig, config),
  new KnipConfigHandler(modulesConfig, config),
  new PrettierConfigHandler(modulesConfig, config),
  new EslintConfigHandler(modulesConfig, config),
  new JscpdConfigHandler(modulesConfig, config),
  new StylelintConfigHandler(modulesConfig, config),
  new StructurelintConfigHandler(modulesConfig, config),
  new SkillslintConfigHandler(modulesConfig, config),
];

const getModulesFromConfig = (
  config: QoqConfig,
  workspaces: IModulesConfig['workspaces']
): IModulesConfig => {
  const modulesConfig = { modules: {}, workspaces } as IModulesConfig;

  getHandlersBySequence(modulesConfig, config).forEach((handler) => handler.getModulesFromConfig());

  // Keep the raw user config around so the BasicExecutor health check can compare
  // it against the defaults the handlers just merged in.
  modulesConfig.rawConfig = config;

  return modulesConfig;
};

export const initConfig = async (
  workspaces: IModulesConfig['workspaces'],
  skipWarmup: boolean = false
): Promise<IModulesConfig> => {
  const modulesConfig = { modules: {}, workspaces } as IModulesConfig;
  const config = {} as QoqConfig;
  const handlers = getHandlersBySequence(modulesConfig, config);

  for (const handler of handlers) {
    await handler.getPrompts();
  }

  searchPlaces.forEach((filename) => {
    const filepath = resolveCwdRelativePath(`/${filename}`);
    if (existsSync(filepath)) {
      rmSync(filepath);
    }
  });

  handlers.forEach((handler) => handler.getConfigFromModules());

  writeFileSync(
    resolveCwdRelativePath(`/${moduleName}.config.js`),
    formatCode(modulesConfig.configType, {}, [], JSON.stringify(config))
  );

  await installPackages(handlers.flatMap((handler) => handler.getPackages()));

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

  if (!qoqConfig) {
    process.stderr.write('No QoQ config found, running with defaults\n');
  }

  // No config + skipInit (staged, --warmup, CI): run on defaults instead of
  // dereferencing an undefined config in the handler chain.
  return getModulesFromConfig((qoqConfig?.config as QoqConfig) ?? {}, workspaces);
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
    skipStructurelint,
    skipSkillslint,
  } = options;

  const hideMessages = !!silent || !!warmup;
  const shouldRun = (name: string) => !tools || tools.includes(name);

  const consoleTimeName = `Total execution time:`;
  const startTime = performance.now();

  // One row per tool, in run order. `moduleKey` marks the tools that additionally
  // need their config block present (stylelint, structurelint, skillslint) —
  // that gate is the only real difference between the rows.
  const registry: IExecutorEntry[] = [
    { name: 'npm', executor: new NpmExecutor(modulesConfig, hideMessages), skip: skipNpm },
    { name: 'knip', executor: new KnipExecutor(modulesConfig, hideMessages), skip: skipKnip },
    {
      name: 'prettier',
      executor: new PrettierExecutor(modulesConfig, hideMessages),
      skip: skipPrettier,
    },
    { name: 'jscpd', executor: new JscpdExecutor(modulesConfig, hideMessages), skip: skipJscpd },
    { name: 'eslint', executor: new EslintExecutor(modulesConfig, hideMessages), skip: skipEslint },
    {
      name: 'stylelint',
      executor: new StylelintExecutor(modulesConfig, hideMessages),
      skip: skipStylelint,
      moduleKey: 'stylelint',
    },
    {
      name: 'structurelint',
      executor: new StructurelintExecutor(modulesConfig, hideMessages),
      skip: skipStructurelint,
      moduleKey: 'structurelint',
    },
    {
      name: 'skillslint',
      executor: new SkillslintExecutor(modulesConfig, hideMessages),
      skip: skipSkillslint,
      moduleKey: 'skillslint',
    },
  ];

  const responses: Record<string, EExitCode> = {};

  for (const { name, executor, skip, moduleKey } of registry) {
    if (skip || !shouldRun(name) || (moduleKey && !modulesConfig.modules[moduleKey])) {
      continue;
    }

    responses[executor.getName()] = await executor.run(options, files);
  }

  // Not a tool: the self-check runs unconditionally, after everything it reports on.
  const basicExecutor = new BasicExecutor(modulesConfig, hideMessages);

  responses[basicExecutor.getName()] = await basicExecutor.run(options, files);

  Object.keys(responses)
    .filter((key) => responses[key] !== EExitCode.OK)
    .forEach((key) => {
      process.exitCode = EExitCode.ERROR;

      process.stderr.write(c.red(`\nQoQ found some ${key} errors!\n\n`));
    });

  if (!hideMessages) {
    process.stdout.write('\n-------------------------\n\n');

    process.stdout.write(
      `${c.italic(c.gray(consoleTimeName))} ${formatExecutionTime(performance.now() - startTime)}\n`
    );
  }
};
