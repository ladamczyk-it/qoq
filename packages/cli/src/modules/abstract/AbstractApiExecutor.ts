import { AbstractExecutor } from './AbstractExecutor.ts';

// Base for tools driven through their JS API (ESLint, Prettier, Stylelint,
// Skillslint, JSCPD): no binary is spawned, so there are no CLI args, and each
// subclass implements execute() itself. `--json` report writing is shared by
// every executor, so it lives on AbstractExecutor.
export abstract class AbstractApiExecutor<TContext = void> extends AbstractExecutor<TContext> {
  protected getCommandArgs(): string[] {
    return [];
  }
}
