import { EConfigType } from './types.ts';

const formatCjs = (imports: Record<string, string>, content: string[], exports: string): string => {
  const importArray = Object.entries(imports).map(
    ([name, source]) => `const ${name} = require('${source}')`
  );

  const code = [...importArray, ...content];

  return code.length > 0
    ? `${code.join(';')}; module.exports = ${exports};`
    : `module.exports = ${exports};`;
};

const formatEsm = (imports: Record<string, string>, content: string[], exports: string): string => {
  const importArray = Object.entries(imports).map(
    ([name, source]) => `import ${name} from '${source}'`
  );

  const code = [...importArray, ...content];

  return code.length > 0
    ? `${code.join(';')}; export default ${exports};`
    : `export default ${exports};`;
};

export const formatCode = (
  format: EConfigType,
  imports: Record<string, string>,
  content: string[],
  exports: string
): string =>
  format === EConfigType.CJS
    ? formatCjs(imports, content, exports)
    : formatEsm(imports, content, exports);
