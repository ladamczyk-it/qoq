# @ladamczyk/check-engine — Agent Context

`@ladamczyk/check-engine` validates that a project's `engines.node` field is consistent with the `engines.node` requirements declared by its dependencies. It is monorepo-aware and fetches live Node.js LTS data for reference.

## Command

```bash
check-engine
```

No configuration file or flags required. Run it from the project root.

## What it checks

For each `package.json` in scope:

1. Reads the package's own `engines.node` value (warns if missing).
2. Collects `engines.node` from every entry in `dependencies` (falls back to `devDependencies` when `dependencies` is empty).
3. Compares the configured range against the collected dependency requirements.
4. Exits with code `1` if the configured `engines.node` does not satisfy (or intersect with) any dependency's requirement.

## Monorepo support

Discovered automatically from the root `package.json` `workspaces` field. Glob patterns with `*` are expanded by reading the filesystem; each discovered sub-package is checked individually.

## Node LTS reference

On each run the tool fetches `https://nodejs.org/download/release/index.json` to report the current and maintained LTS versions. If the network is unavailable it falls back to a bundled `node.json` snapshot in the package root.

## Integration

Typically wired into the pre-push hook via `@ladamczyk/qoq-cli`:

```json
"scripts": {
  "check:engine": "check-engine"
}
```

Or directly as part of a CI step to enforce node compatibility across all packages before publish.
