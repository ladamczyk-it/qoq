import { readFileSync } from 'fs';
import { resolve } from 'path';

import type { Linter } from 'eslint';

type TEnabledRulesConfig = Pick<Linter.Config, 'rules'>;

const isEnabled = (entry: Linter.RuleEntry): boolean => {
  const severity = Array.isArray(entry) ? entry[0] : entry;

  return severity !== 0 && severity !== 'off';
};

/**
 * Names of every rule a config actually turns on (severity other than
 * `off`/`0`), read straight from the resolved flat config (e.g. `baseConfig`
 * from a package's `index.ts`). Keeping this off the `@eslint/config-inspector`
 * payload means the package's own config is the source of truth.
 */
export const getEnabledRuleNames = (config: TEnabledRulesConfig): string[] => {
  const enabled = new Set<string>();

  for (const [name, entry] of Object.entries(config.rules ?? {})) {
    if (entry !== undefined && isEnabled(entry)) {
      enabled.add(name);
    }
  }

  return [...enabled].sort((first, second) => first.localeCompare(second));
};

/**
 * `@eslint/config-inspector build` writes its payload (under `<stats>/__rpc-dump`)
 * as a `structured-clone` graph: a flat array of `[type, value]` records where
 * nested values are referenced by their index in that same array. ESLint's
 * payload only ever uses the four tags handled below.
 */
type TCloneRecord = readonly [type: number, value?: unknown];

const CLONE_TYPE = {
  primitive: 0,
  array: 1,
  object: 2,
} as const;

const deserialize = (records: readonly TCloneRecord[]): unknown => {
  const cache = new Map<number, unknown>();

  const resolveRef = (index: number): unknown => {
    if (cache.has(index)) {
      return cache.get(index);
    }

    const record = records[index];

    if (record === undefined) {
      cache.set(index, undefined);
      return undefined;
    }

    const [type, value] = record;

    switch (type) {
      case CLONE_TYPE.array: {
        const list: unknown[] = [];
        cache.set(index, list);
        for (const ref of value as number[]) {
          list.push(resolveRef(ref));
        }
        return list;
      }
      case CLONE_TYPE.object: {
        const obj: Record<string, unknown> = {};
        cache.set(index, obj);
        for (const [keyRef, valueRef] of value as [number, number][]) {
          obj[resolveRef(keyRef) as string] = resolveRef(valueRef);
        }
        return obj;
      }
      case CLONE_TYPE.primitive:
        cache.set(index, value);
        return value;
      default:
        // VOID (-1) and any unsupported tag collapse to `undefined`.
        cache.set(index, undefined);
        return undefined;
    }
  };

  return resolveRef(0);
};

interface IInspectorRuleMeta {
  deprecated?: boolean | Record<string, unknown>;
}

interface IInspectorPayload {
  output?: {
    rules?: Record<string, IInspectorRuleMeta>;
  };
}

export interface IDeprecatedRule {
  name: string;
  deprecated: NonNullable<IInspectorRuleMeta['deprecated']>;
}

const FALLBACK_PAYLOAD_PATH = '__rpc-dump/eslint-config-inspector~get-payload.fallback.json';

/**
 * The rule registry from a package's `stats/` build: every rule the inspector
 * knows about, carrying the plugin metadata (including `deprecated`). Throws if
 * the payload can't be parsed into rules, so a silently changed serialization
 * fails loudly instead of letting the deprecation guard pass for free.
 */
const readRuleRegistry = (statsDir: string): Record<string, IInspectorRuleMeta> => {
  const payloadPath = resolve(statsDir, FALLBACK_PAYLOAD_PATH);
  const records = JSON.parse(readFileSync(payloadPath, 'utf-8')) as TCloneRecord[];
  const rules = (deserialize(records) as IInspectorPayload).output?.rules;

  if (!rules || Object.keys(rules).length === 0) {
    throw new Error(
      `No rules found in the config-inspector payload at ${payloadPath}; its serialization may have changed.`
    );
  }

  return rules;
};

/**
 * Rules the config enables whose plugin metadata marks them as deprecated. An
 * empty array means the config is clean. Used as a regression guard so that a
 * dependency bump which deprecates a rule we enable fails the test suite.
 */
export const getEnabledDeprecatedRules = (
  config: TEnabledRulesConfig,
  statsDir: string
): IDeprecatedRule[] => {
  const registry = readRuleRegistry(statsDir);
  const deprecated: IDeprecatedRule[] = [];

  for (const name of getEnabledRuleNames(config)) {
    const meta = registry[name];

    if (meta?.deprecated) {
      deprecated.push({ name, deprecated: meta.deprecated });
    }
  }

  return deprecated.sort((first, second) => first.name.localeCompare(second.name));
};
