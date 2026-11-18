import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { createRequire } from 'module';
import { tmpdir } from 'os';
import { join } from 'path';
import { stripVTControlCharacters } from 'util';

import { EExitCode, getRelativePath, resolveCwdPath } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { TerminateExecutorGracefully } from '../../helpers/exceptions/TerminateExecutorGracefully.ts';
import { AbstractApiExecutor } from '../abstract/AbstractApiExecutor.ts';
import { IExecutorOptions } from '../types.ts';

import { JscpdConfigHandler } from './JscpdConfigHandler.ts';
import { IModuleJscpdConfig } from './types.ts';

interface IJscpdReportFile {
  name: string;
  start: number;
  end: number;
}

// The slice of jscpd v5's own `jscpd-report.json` this executor reads.
interface IJscpdReport {
  statistics: { total: { percentage: number } };
  duplicates: {
    format: string;
    lines: number;
    firstFile: IJscpdReportFile;
    secondFile: IJscpdReportFile;
  }[];
}

// Lines jscpd prints after the console reporter's table: the json reporter's
// "saved to <tmp dir>" notice (that dir is ours, and gone by the time anyone
// reads it) and jscpd's own timer. AbstractExecutor#run prints a timer of its own.
const NOISE = /^(JSON report saved to |time: )/;

export class JscpdExecutor extends AbstractApiExecutor {
  getName(): string {
    return this.getCommandName().toUpperCase();
  }

  protected getCommandName(): string {
    return 'jscpd';
  }

  protected prepare(): Promise<void> {
    if (!this.modulesConfig.modules.jscpd) {
      throw new TerminateExecutorGracefully();
    }

    return Promise.resolve();
  }

  protected execute(_args: string[], options: IExecutorOptions): Promise<string | EExitCode> {
    const {
      format,
      threshold = JscpdConfigHandler.DEFAULT_THRESHOLD,
      ignore,
    } = this.modulesConfig.modules.jscpd as IModuleJscpdConfig;

    // Resolved from the consumer's on-demand install (via the @ladamczyk/qoq-jscpd
    // peer dependency); kept external in rolldown.config.js. jscpd v5 is a native
    // binary, and `runJscpd` is its package's own launcher for this platform's build.
    const { runJscpd } = createRequire(import.meta.url)('jscpd') as typeof import('jscpd');

    // jscpd exits 1 both over the threshold and on its own errors (a missing path,
    // an unknown format), so the exit code can't be the verdict. The json report
    // always gets written to a scratch dir instead, and the verdict is read off it.
    const reportDir = mkdtempSync(join(tmpdir(), 'qoq-jscpd-'));

    try {
      const result = runJscpd(
        [
          ...this.getPaths(),
          '--absolute',
          '--format',
          format.join(','),
          '--threshold',
          String(threshold),
          '--no-tips',
          // One flag per pattern: v5 splits a single value on commas.
          ...(ignore ?? []).flatMap((pattern) => ['--ignore', pattern]),
          ...(options.json ? ['--silent', '--reporters', 'json'] : ['--reporters', 'console,json']),
          '--output',
          reportDir,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      );
      const reportPath = join(reportDir, 'jscpd-report.json');

      if (result.error || !existsSync(reportPath)) {
        throw new Error(
          result.error?.message ?? (result.stderr.trim() || `jscpd exited ${result.status}`)
        );
      }

      const report = JSON.parse(readFileSync(reportPath, 'utf8')) as IJscpdReport;

      if (options.json) {
        this.writeReport(this.buildReport(report), options.output);
      } else {
        process.stdout.write(
          result.stdout
            .split('\n')
            .filter((line) => !NOISE.test(stripVTControlCharacters(line)))
            .join('\n')
        );
      }

      const { percentage } = report.statistics.total;
      const exceeded = percentage > threshold;

      if (exceeded && !this.silent) {
        process.stderr.write(
          c.red(
            `ERROR: jscpd found too many duplicates (${percentage}%) over threshold (${threshold}%)\n`
          )
        );
      }

      return Promise.resolve(exceeded ? EExitCode.ERROR : EExitCode.OK);
    } catch (e) {
      // AbstractExecutor#run reports any throw as a bare "Unknown error!", so the
      // reason (no binary for this platform, a bad path) is printed here first.
      process.stderr.write(c.red(`jscpd: ${(e as Error).message}\n`));

      throw e;
    } finally {
      rmSync(reportDir, { recursive: true, force: true });
    }
  }

  // Lean JSON report for `--json`: keep only the clone locations and overall
  // duplication percentage that summarize.mjs needs — drop jscpd's heavy
  // `fragment` source blobs, token counts, locations and per-format stats.
  private buildReport({ statistics, duplicates }: IJscpdReport): {
    percentage: number;
    clones: IJscpdReport['duplicates'];
  } {
    const file = ({ name, start, end }: IJscpdReportFile): IJscpdReportFile => ({
      name,
      start,
      end,
    });

    return {
      percentage: statistics.total.percentage,
      clones: duplicates.map(({ format, lines, firstFile, secondFile }) => ({
        format,
        lines,
        firstFile: file(firstFile),
        secondFile: file(secondFile),
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
