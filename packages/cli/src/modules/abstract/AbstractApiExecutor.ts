import { writeFileSync } from 'fs';

import { AbstractExecutor } from './AbstractExecutor.ts';

// Base for tools driven through their JS API (ESLint, Prettier, Stylelint,
// Skillslint, JSCPD): no binary is spawned, so there are no CLI args, and each
// subclass implements execute() itself. Shared `--json` report writing lives here.
export abstract class AbstractApiExecutor extends AbstractExecutor {
  protected getCommandArgs(): string[] {
    return [];
  }

  // Writes the tool's lean `--json` report to <output>/<tool>-report.json.
  protected writeReport(report: unknown, output: string): void {
    writeFileSync(`${output}/${this.getCommandName()}-report.json`, JSON.stringify(report));
  }
}
