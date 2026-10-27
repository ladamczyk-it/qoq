import { IModuleEslintConfig } from '../modules/eslint/types.ts';
import { TJscpdFormat } from '../modules/jscpd/types.ts';
import { IModuleNpmConfig } from '../modules/npm/types.ts';
import { IModulePrettierConfig } from '../modules/prettier/types.ts';
import { IScanConfig } from '../modules/scan/types.ts';
import { IModuleSkillslintConfig } from '../modules/skillslint/types.ts';
import { TModuleStructurelintConfig } from '../modules/structurelint/types.ts';
import { TModuleStylelintConfig } from '../modules/stylelint/types.ts';

export type TPartialBy<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export enum EConfigType {
  CJS = 'CJS',
  ESM = 'ESM',
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface QoqConfig {
  srcPath?: string;
  // Overrides the CJS/ESM format auto-detected from the consumer's package.json
  // "type" field. Not offered by the wizard — explicit config authoring only.
  configType?: `${EConfigType}`;
  // Consent for anonymous usage stats. Undefined means "not asked yet" — an
  // interactive run prompts once and writes the answer back here.
  stats?: boolean;
  // `false` hides the qoq skill hint printed after a failing run and the wizard.
  hints?: boolean;
  // Opt-ins for experimental features. The CLI itself reads none of them; the qoq
  // skill reads them from this file's source text.
  future?: {
    // `qoq execute` documents each delivered milestone through qoq-scribe.
    unstable_skill_docs?: boolean;
    // `qoq bump` plans from `qoq scan` too, not just the outdated report.
    unstable_skill_bump_with_scan?: boolean;
    // `qoq plan`/`replan` chart the plan before approval, and `qoq execute` charts
    // the scribe's docs when docs are on too — through qoq-artist.
    unstable_skill_diagrams?: boolean;
    // `qoq plan --tool <tracker>` may raise the approved plan in that tracker. The
    // flag alone is refused: only `local` is tested.
    unstable_skill_plan_jira?: boolean;
    unstable_skill_plan_linear?: boolean;
    unstable_skill_plan_trello?: boolean;
  };
  npm?: IModuleNpmConfig;
  scan?: IScanConfig;
  prettier?: IModulePrettierConfig;
  eslint?: IModuleEslintConfig[];
  jscpd?: {
    format?: TJscpdFormat[];
    threshold?: number;
    ignore?: string[];
  };
  stylelint?: TModuleStylelintConfig;
  structurelint?: TModuleStructurelintConfig;
  skillslint?: IModuleSkillslintConfig;
  knip?: {
    entry?: string[];
    project?: string[];
    ignore?: string[];
    ignoreDependencies?: string[];
    ignoreBinaries?: string[];
    ignoreFiles?: string[];
    ignoreMembers?: string[];
    ignoreUnresolved?: string[];
  };
  configPaths?: {
    prettier?: string;
    eslint?: string;
    stylelint?: string;
  };
}
