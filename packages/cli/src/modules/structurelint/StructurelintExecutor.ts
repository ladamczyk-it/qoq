import { statSync } from 'fs';

import { EExitCode, resolveCwdPath } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { AbstractApiExecutor } from '../abstract/AbstractApiExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import type { ILintResult, IStructureConfig } from '@ladamczyk/structurelint';

export class StructurelintExecutor extends AbstractApiExecutor {
  protected getCommandName(): string {
    return 'structurelint';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected prepare(_args: string[], _options: IExecutorOptions): Promise<EExitCode> {
    const {
      modules: { structurelint },
    } = this.modulesConfig;

    if (!structurelint) {
      throw new TerminateExecutorGracefully();
    }

    return Promise.resolve(EExitCode.OK);
  }

  protected async execute(_args: string[], options: IExecutorOptions): Promise<string | EExitCode> {
    const {
      modules: { structurelint },
    } = this.modulesConfig;

    // prepare() already guards this; re-narrow here so `structurelint` is defined.
    if (!structurelint) {
      throw new TerminateExecutorGracefully();
    }

    const { structure } = structurelint;

    if (!structure) {
      process.stderr.write(
        c.red(
          'Structurelint is enabled but no `structure` was provided. Add a `structure` array directly under the `structurelint` block in qoq.config.*.\n'
        )
      );

      return process.exit(EExitCode.EXCEPTION);
    }

    const { validate, format } = await import('@ladamczyk/structurelint');

    const result = this.validateWithInlineConfig(validate, { ...structurelint, structure });

    if (options.json) {
      this.writeReport(result, options.output);
    } else {
      process.stdout.write(format(result));
    }

    return result.passed ? EExitCode.OK : EExitCode.ERROR;
  }

  private validateWithInlineConfig(
    validate: (typeof import('@ladamczyk/structurelint'))['validate'],
    config: IStructureConfig
  ): ILintResult {
    const path = config.structureRoot ?? '.';
    const absoluteRoot = resolveCwdPath(`/${path}`);

    let isDirectory: boolean;

    try {
      isDirectory = statSync(absoluteRoot).isDirectory();
    } catch {
      isDirectory = false;
    }

    if (!isDirectory) {
      process.stderr.write(c.red(`Structure root "${path}" does not exist or is not a folder.\n`));

      return process.exit(EExitCode.EXCEPTION);
    }

    const violations = validate(absoluteRoot, config);

    return { root: path, passed: violations.length === 0, violations };
  }
}
