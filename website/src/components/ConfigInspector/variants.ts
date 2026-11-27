// The `@ladamczyk/qoq-eslint-v9-*` presets that ship a prebuilt config
// inspector. Each `variant` matches the package suffix and the sub-path the
// inspector is synced to under `static/config-inspector/` by
// `scripts/sync-config-inspectors.mjs`.

interface IInspectorVariant {
  readonly variant: string;
  readonly packageName: string;
  readonly label: string;
}

const VARIANT_SUFFIXES = [
  'js',
  'js-react',
  'js-jest',
  'js-jest-rtl',
  'js-vitest',
  'js-vitest-rtl',
  'ts',
  'ts-react',
  'ts-jest',
  'ts-jest-rtl',
  'ts-vitest',
  'ts-vitest-rtl',
] as const;

export type TPresetVariant = `eslint-v9-${(typeof VARIANT_SUFFIXES)[number]}`;

const TOKEN_LABELS: Record<string, string> = {
  js: 'JavaScript',
  ts: 'TypeScript',
  react: 'React',
  jest: 'Jest',
  vitest: 'Vitest',
  rtl: 'React Testing Library',
};

function toLabel(suffix: string): string {
  return suffix
    .split('-')
    .map((token) => TOKEN_LABELS[token] ?? token)
    .join(' + ');
}

export const INSPECTOR_VARIANTS: IInspectorVariant[] = VARIANT_SUFFIXES.map((suffix) => ({
  variant: `eslint-v9-${suffix}`,
  packageName: `@ladamczyk/qoq-eslint-v9-${suffix}`,
  label: toLabel(suffix),
}));
