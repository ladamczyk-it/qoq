import { relative, resolve } from 'path';

import { EExitCode } from '@ladamczyk/qoq-utils';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { AbstractApiExecutor } from '../abstract/AbstractApiExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import type { ILintResult, TTextlintLintResult } from '@ladamczyk/skillslint';

export class SkillslintExecutor extends AbstractApiExecutor {
  protected getCommandName(): string {
    return 'skillslint';
  }

  protected prepare(
    _args: string[],
    _options: IExecutorOptions,
    files: string[] = []
  ): Promise<void> {
    const {
      modules: { skillslint },
    } = this.modulesConfig;

    if (!skillslint) {
      throw new TerminateExecutorGracefully();
    }

    // Skills are scored as a whole, so a staged run can't narrow the lint — but
    // a commit that touches nothing under `path` has nothing for it to judge.
    const isUnderPath = (file: string): boolean =>
      !relative(resolve(skillslint.path), resolve(file)).startsWith('..');

    if (files.length > 0 && !files.some(isUnderPath)) {
      throw new TerminateExecutorGracefully();
    }

    return Promise.resolve();
  }

  protected async execute(_args: string[], options: IExecutorOptions): Promise<string | EExitCode> {
    const {
      modules: { skillslint },
    } = this.modulesConfig;

    // prepare() already guards this; re-narrow here so `path` is a defined string.
    if (!skillslint) {
      throw new TerminateExecutorGracefully();
    }

    const { lint, format } = await import('@ladamczyk/skillslint');
    // Skillslint's API takes no consent of its own and never prompts: it counts
    // a run only if we hand it one, so QoQ's own answer is what decides.
    const result = await lint({
      path: skillslint.path,
      fix: options.fix,
      stats: !!this.modulesConfig.stats,
    });

    if (options.json) {
      this.writeReport(this.buildReport(result), options.output);
    } else {
      process.stdout.write(await format(result));
    }

    return result.passed ? EExitCode.OK : EExitCode.ERROR;
  }

  // Lean JSON report for `--json`: drop textlint's full fixed-file `output` blobs
  // and keep only what summarize.mjs needs — per-file messages plus skill scores.
  private buildReport(result: ILintResult): {
    passed: boolean;
    fixed: boolean;
    skills: ILintResult['skills'];
    textlint: { filePath: string; messages: TTextlintLintResult['messages'] }[];
  } {
    return {
      passed: result.passed,
      fixed: result.fixed,
      skills: result.skills,
      textlint: result.textlint.map((file) => ({
        filePath: file.filePath,
        messages: 'remainingMessages' in file ? file.remainingMessages : file.messages,
      })),
    };
  }
}
