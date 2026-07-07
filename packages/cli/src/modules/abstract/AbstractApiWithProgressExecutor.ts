import c from 'picocolors';

import { IExecutorOptions } from '../types.ts';

import { AbstractApiExecutor } from './AbstractApiExecutor.ts';

// Rule/plugin id subclasses inject into their tool's config to get a per-file
// progress hook (ESLint's overrideConfig, Stylelint's config plugins). Never
// surfaced to the user; just needs to be namespaced and unique.
export const PROGRESS_PLUGIN_NAMESPACE = 'qoq-internal';
export const PROGRESS_RULE_NAME = 'file-progress';
export const PROGRESS_RULE_ID = `${PROGRESS_PLUGIN_NAMESPACE}/${PROGRESS_RULE_NAME}`;

const clearLine = '\r\x1b[K';

// Shared "live per-file progress" output for API-driven tools (ESLint,
// Prettier, Stylelint) — what `eslint-plugin-file-progress` used to provide,
// only for ESLint. None of these JS APIs expose a public per-file callback on
// their bulk-lint entry points, so subclasses feed printProgress() from
// whatever hook they can get: Prettier already loops over files itself;
// ESLint/Stylelint inject a rule that runs once per file with no visitor/report
// of its own, purely to observe the filename as it's processed.
export abstract class AbstractApiWithProgressExecutor extends AbstractApiExecutor {
  // Progress is decorative: skip it under --silent/--warmup (this.silent) and
  // --json, so it never mixes into machine-readable output.
  protected showProgress(options: IExecutorOptions): boolean {
    return !this.silent && !options.json;
  }

  protected printProgress(file: string): void {
    const text = `${c.cyan('Processing:')} ${c.green(file)}`;

    process.stdout.write(process.stdout.isTTY ? `${clearLine}${text}` : `${text}\n`);
  }

  // Clears the in-place progress line (if any) without printing anything else
  // — for tools (Prettier) that always print their own final summary
  // regardless of outcome.
  protected clearProgress(): void {
    if (process.stdout.isTTY) {
      process.stdout.write(clearLine);
    }
  }

  // Clears the progress line and, on success, prints a generic "done" line —
  // for tools (ESLint, Stylelint) that otherwise print nothing when clean.
  protected finishProgress(success: boolean): void {
    this.clearProgress();

    if (success) {
      process.stdout.write(`${c.green('✔')} ${this.getName()} done.\n`);
    }
  }
}
