import type { IStructureConfig } from '@ladamczyk/structurelint';

// The `structurelint` block in qoq.config.* mirrors structurelint's own
// `IStructureConfig` directly (no `path` — `structureRoot` already covers it),
// with everything optional since the block itself is optional to enable the tool.
export type TModuleStructurelintConfig = Partial<IStructureConfig>;
