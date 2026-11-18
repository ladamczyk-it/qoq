import { AbstractExecutor } from './AbstractExecutor.ts';

// Base for tools driven through their JS API (ESLint, Prettier, Stylelint,
// Skillslint, JSCPD): qoq spawns no binary itself, so there are no CLI args, and
// each subclass implements execute() itself. JSCPD's API is its package's own
// launcher for a native build, which builds its args inside execute(). `--json` report writing is shared by
// every executor, so it lives on AbstractExecutor.
export abstract class AbstractApiExecutor<TContext = void> extends AbstractExecutor<TContext> {
  protected getCommandArgs(): string[] {
    return [];
  }
}
