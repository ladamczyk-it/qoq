import { EExitCode } from '@ladamczyk/qoq-utils';
import c from 'picocolors';

import { AbstractExecutor } from '../abstract/AbstractExecutor.ts';
import { EModulesEslint, IModuleEslintConfig } from '../eslint/types.ts';

import { collectRedundancies, IRedundancyWarning, TRulesRecord } from './checks.ts';

// In-process "self health check": warns about redundant qoq.config.* entries that
// duplicate a tool default or a rule already declared in the selected ESLint base
// config. It spawns no binary and is non-blocking — it only ever reports.
export class BasicExecutor extends AbstractExecutor {
  protected getCommandName(): string {
    return 'Selfcheck';
  }

  protected getCommandArgs(): string[] {
    return [];
  }

  // No external binary and no cache file, so skip AbstractExecutor.prepare (which
  // would demand a CACHE_PATH).
  protected prepare(): Promise<EExitCode> {
    return Promise.resolve(EExitCode.OK);
  }

  protected async execute(): Promise<string | EExitCode> {
    const config = this.modulesConfig.rawConfig;

    if (!config) {
      return EExitCode.OK;
    }

    const baseRulesByIndex = await this.loadBaseRules(config.eslint ?? []);
    const warnings = collectRedundancies(config, baseRulesByIndex);

    if (warnings.length > 0 && !this.silent) {
      this.printWarnings(warnings);
    }

    // Always OK — the config health check never fails a run, it only warns.
    return EExitCode.OK;
  }

  // Resolve the base rules for every entry that extends a qoq-eslint-v9-* template
  // by importing the template at runtime (it is a peer dependency installed in the
  // consumer project). Missing/uninstalled templates are skipped silently.
  private async loadBaseRules(
    entries: IModuleEslintConfig[]
  ): Promise<Record<number, TRulesRecord | undefined>> {
    const baseRulesByIndex: Record<number, TRulesRecord | undefined> = {};

    await Promise.all(
      entries.map(async (entry, index) => {
        const { template } = entry;

        if (!template || !(Object.values(EModulesEslint) as string[]).includes(template)) {
          return;
        }

        try {
          const { baseConfig } = (await import(`@ladamczyk/${template}`)) as {
            baseConfig?: { rules?: TRulesRecord };
          };

          baseRulesByIndex[index] = baseConfig?.rules;
        } catch {
          // Template not installed — nothing to compare against.
        }
      })
    );

    return baseRulesByIndex;
  }

  private printWarnings(warnings: IRedundancyWarning[]): void {
    const label = warnings.length === 1 ? 'entry' : 'entries';

    process.stdout.write(
      c.yellow(`\nConfig health check found ${warnings.length} redundant ${label}:\n`)
    );

    warnings.forEach((warning) => {
      const reason =
        warning.reason === 'default'
          ? 'matches the tool default'
          : `already set in ${warning.template ?? 'the'} base config`;

      process.stdout.write(c.yellow(`  • ${warning.path} = ${warning.value} — ${reason}\n`));
    });
  }
}
