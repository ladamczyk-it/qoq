import micromatch from 'micromatch';

import { IModuleEslintConfig } from '../eslint/types.ts';
import { StylelintExecutor } from '../stylelint/StylelintExecutor.ts';
import { IModulesConfig } from '../types.ts';

import type { TFileProvider } from '@ladamczyk/justify-disable';

// ESLint's own default when a config object has no `files`.
const ESLINT_DEFAULT_FILES = ['**/*.js', '**/*.mjs', '**/*.cjs'];

const matches = (path: string, pattern: string) => micromatch.isMatch(path, pattern, { dot: true });

// ponytail: an entry's `basePath` is ignored, paths are matched cwd-relative.
const isCoveredByEslintEntry = (path: string, { files, ignores }: IModuleEslintConfig) => {
  const patterns = files ?? ESLINT_DEFAULT_FILES;
  const isIncluded = patterns.some((pattern) =>
    Array.isArray(pattern) ? pattern.every((part) => matches(path, part)) : matches(path, pattern)
  );

  if (!isIncluded) {
    return false;
  }

  // Mirrors @eslint/config-array: a plain pattern ignores, a later `!pattern` un-ignores.
  const isIgnored = (ignores ?? []).reduce(
    (ignored, pattern) =>
      pattern.startsWith('!')
        ? ignored && !matches(path, pattern.slice(1))
        : ignored || matches(path, pattern),
    false
  );

  return !isIgnored;
};

/**
 * Scopes justify-disable to what qoq's own eslint and stylelint config lint, so it never reports
 * on files those tools skip. Non-empty `paths` (staged run) are taken as given and skip git.
 * A file matching neither tool is omitted, so `tools` is never empty.
 */
// ponytail: tracked-but-gitignored files are scanned although ESLint skips them.
export const createJustifyDisableFileProvider =
  (
    { srcPath, modules }: Pick<IModulesConfig, 'srcPath' | 'modules'>,
    deps: { listRepositoryFiles: TFileProvider; extensions: Record<string, string[]> }
  ): TFileProvider =>
  async ({ paths }) => {
    const candidates =
      paths.length > 0
        ? paths
        : (await deps.listRepositoryFiles({ paths: [] })).map((file) => file.path);
    const stylelintGlob = modules.stylelint
      ? StylelintExecutor.getFilesGlob(modules.stylelint, srcPath)
      : null;

    return candidates.flatMap((path) => {
      const extensionTools = deps.extensions[path.split('.').pop()?.toLowerCase() ?? ''] ?? [];
      const tools = [
        ...(extensionTools.includes('eslint') &&
        (modules.eslint ?? []).some((entry) => isCoveredByEslintEntry(path, entry))
          ? ['eslint']
          : []),
        ...(extensionTools.includes('stylelint') &&
        stylelintGlob &&
        micromatch.isMatch(path, stylelintGlob)
          ? ['stylelint']
          : []),
      ];

      return tools.length > 0 ? [{ path, tools }] : [];
    });
  };
