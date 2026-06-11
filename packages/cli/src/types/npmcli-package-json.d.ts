declare module '@npmcli/package-json/lib/read-package' {
  export const readPackage: (path: string) => Promise<Record<string, unknown>>;
}
