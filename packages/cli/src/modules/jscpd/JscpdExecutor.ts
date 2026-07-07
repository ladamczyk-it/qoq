import { readdirSync } from 'fs';
import { createRequire } from 'module';

import { EExitCode, getRelativePath, resolveCwdPath } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { AbstractApiExecutor } from '../abstract/AbstractApiExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import { JscpdConfigHandler } from './JscpdConfigHandler.ts';
import { IModuleJscpdConfig } from './types.ts';

import type { IClone, IStatistic } from '@jscpd/core';

export class JscpdExecutor extends AbstractApiExecutor {
  getName(): string {
    return this.getCommandName().toUpperCase();
  }

  protected getCommandName(): string {
    return 'jscpd';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected prepare(_args: string[], _options: IExecutorOptions): Promise<EExitCode> {
    if (!this.modulesConfig.modules.jscpd) {
      throw new TerminateExecutorGracefully();
    }

    return Promise.resolve(EExitCode.OK);
  }

  protected async execute(_args: string[], options: IExecutorOptions): Promise<string | EExitCode> {
    const { format, threshold, ignore } = this.modulesConfig.modules.jscpd as IModuleJscpdConfig;

    // Resolved from the consumer's on-demand install (via the @ladamczyk/qoq-jscpd
    // peer dependency); kept external in rollup.bin.js. We `require` the CJS build
    // rather than `import()` it: jscpd's ESM entry transitively imports
    // `colors/safe` without an extension, which Node's ESM resolver rejects.
    const { detectClonesAndStatistic } = createRequire(import.meta.url)(
      'jscpd'
    ) as typeof import('jscpd');

    const detectionOptions = {
      path: this.getPaths(),
      absolute: true,
      format,
      threshold: threshold ?? JscpdConfigHandler.DEFAULT_THRESHOLD,
      noTips: !options.configHints,
      silent: Boolean(options.json),
      reporters: options.json ? [] : ['console'],
      ...(ignore?.length ? { ignore } : {}),
    };

    // jscpd gates its own `console.time('time')`/`console.timeEnd('time')` on the
    // same `silent` option as the console reporter's duplication table, so we
    // can't disable one without the other via options alone. We want the table
    // (the actual finding) but not jscpd's own timer line — we already print a
    // consistently-formatted one of our own in AbstractExecutor#run — so the
    // built-in timer is muted for the duration of the call.

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const noop = (): void => {};
    const { time: originalTime, timeEnd: originalTimeEnd } = console;

    console.time = noop;
    console.timeEnd = noop;

    let clones: IClone[];
    let statistic: IStatistic;

    try {
      ({ clones, statistic } = await detectClonesAndStatistic(detectionOptions));
    } finally {
      console.time = originalTime;
      console.timeEnd = originalTimeEnd;
    }

    if (options.json) {
      this.writeReport(this.buildReport(clones, statistic), options.output);
    }

    const exceeded = statistic.total.percentage > detectionOptions.threshold;

    if (exceeded && !this.silent) {
      process.stderr.write(
        c.red(
          `ERROR: jscpd found too many duplicates (${statistic.total.percentage}%) over threshold (${detectionOptions.threshold}%)\n`
        )
      );
    }

    return exceeded ? EExitCode.ERROR : EExitCode.OK;
  }

  // Lean JSON report for `--json`: keep only the clone locations and overall
  // duplication percentage that summarize.mjs needs — drop jscpd's heavy
  // `fragment` source blobs, token counts, blame data and per-format stats.
  private buildReport(
    clones: IClone[],
    statistic: IStatistic
  ): {
    percentage: number;
    clones: {
      format: string;
      lines: number;
      firstFile: { name: string; start: number; end: number };
      secondFile: { name: string; start: number; end: number };
    }[];
  } {
    return {
      percentage: statistic.total.percentage,
      clones: clones.map((clone) => ({
        format: clone.format,
        lines: clone.duplicationA.end.line - clone.duplicationA.start.line + 1,
        firstFile: {
          name: clone.duplicationA.sourceId,
          start: clone.duplicationA.start.line,
          end: clone.duplicationA.end.line,
        },
        secondFile: {
          name: clone.duplicationB.sourceId,
          start: clone.duplicationB.start.line,
          end: clone.duplicationB.end.line,
        },
      })),
    };
  }

  private getPaths(): string[] {
    const { srcPath, workspaces } = this.modulesConfig;

    if (!workspaces) {
      return [srcPath];
    }

    return workspaces.reduce((acc: string[], current) => {
      if (!current.includes('*')) {
        acc.push(current);
      } else {
        const path = `/${current.replaceAll('*', '')}`;

        return acc.concat(
          readdirSync(resolveCwdPath(path), { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map(({ parentPath, name }) => getRelativePath(`${parentPath}/${name}`))
        );
      }

      return acc;
    }, []);
  }
}
