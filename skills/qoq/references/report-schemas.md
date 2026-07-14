# Report schemas

The shape of each `*-report.json` that `qoq --json --output <dir>` writes. You
normally don't need this — `scripts/summarize.mjs` reads all of these for you and
prints a compact digest. Reach for a raw report only when one finding needs detail
the digest doesn't carry (a precise unused-export position, the full message text
of one ESLint finding), and then read just that entry, not the whole file.

All files land in the `--output` directory (default `bin/report/`; the skill uses
the shared workspace `.qoq/reports/`). A file is absent when its tool was skipped
or disabled.

---

## prettier-report.json

QoQ writes this itself (it's not a native Prettier format): a flat list of files
whose formatting differs.

```json
{ "issues": ["src/a.ts", "src/b.scss"] }
```

`issues` empty ⇒ Prettier is clean.

---

## eslint-report.json

QoQ writes this from ESLint's JS API — a lean array, one entry per linted file.
It mirrors the native JSON formatter's `filePath`/`messages` but drops each
result's heavy `source`/`output` file blobs and the per-file count fields, and
flattens each message's `fix` object to a boolean.

```json
[
  {
    "filePath": "/abs/path/src/a.ts",
    "messages": [
      {
        "ruleId": "@typescript-eslint/no-explicit-any",
        "severity": 2,
        "message": "Unexpected any.",
        "line": 4,
        "column": 12,
        "fix": true
      }
    ]
  }
]
```

`severity`: `2` = error, `1` = warning. `fix: true` ⇒ ESLint can auto-fix it
(so `qoq --fix` will). `ruleId` is `null` for parse/syntax errors.

---

## knip-report.json

Knip's JSON reporter. Shape varies a little across Knip versions; the summarizer
handles both. The common shape is a top-level `files` array (fully-unused files)
plus an `issues` array (per-file findings):

```json
{
  "files": ["src/orphan.ts"],
  "issues": [
    {
      "file": "src/a.ts",
      "exports": ["unusedFn"],
      "types": ["UnusedType"],
      "dependencies": [],
      "devDependencies": [],
      "unlisted": [],
      "unresolved": [],
      "binaries": [],
      "duplicates": [],
      "enumMembers": {},
      "classMembers": {}
    },
    { "file": "package.json", "dependencies": ["lodash"], "unlisted": ["chalk"] }
  ]
}
```

Entries within a category may be plain strings or objects (`{ name, line, col }`)
depending on version — read `.name` when it's an object. `dependencies` on the
`package.json` entry are the unused declared deps; `unlisted` are imported-but-
undeclared.

---

## jscpd-report.json

Written by the CLI's `JscpdExecutor` — a lean shape, not jscpd's native reporter
output. `clones` is the list of clone pairs; `percentage` is the overall
duplication ratio to compare against `jscpd.threshold`. jscpd's heavy `fragment`
source blobs, token counts, and blame data are dropped at the source.

```json
{
  "percentage": 1.5,
  "clones": [
    {
      "format": "typescript",
      "lines": 15,
      "firstFile": { "name": "src/a.ts", "start": 10, "end": 25 },
      "secondFile": { "name": "src/b.ts", "start": 40, "end": 55 }
    }
  ]
}
```

The report carries **locations only** — when planning an extraction, read the
duplicated code from the source files at the reported line ranges (both sites,
keeping the extraction faithful to both copies).

---

## npm-report.json

Written by the CLI's `npm` module (`NpmExecutor`) — already the semver-compared,
deduped result, not a passthrough of raw `npm outdated` output. Packages are
pre-bucketed by the jump from installed to latest version:

```json
{
  "major": [{ "name": "eslint", "current": "8.57.0", "latest": "9.9.0" }],
  "minor": [{ "name": "prettier", "current": "3.2.0", "latest": "3.3.1" }],
  "patch": [{ "name": "picocolors", "current": "1.0.0", "latest": "1.0.1" }]
}
```

Each bucket is an array of `{ name, current, latest }`; a package that appears
across multiple workspaces is collapsed to one entry (lowest `current`, highest
`latest`). Doesn't say whether a package is a `dependencies` or `devDependencies`
entry — cross-reference `package.json` for that. Subject to a throttle (see
[engine.md](engine.md)) — absent doesn't always mean "nothing outdated", it can
mean "skipped this run".

---

## stylelint-report.json

Native Stylelint JSON formatter output — an array, one entry per source file.

```json
[
  {
    "source": "/abs/path/src/a.scss",
    "warnings": [
      { "line": 3, "column": 5, "rule": "block-no-empty", "severity": "error", "text": "…" }
    ],
    "errored": true
  }
]
```

Some Stylelint versions add a `fixable` boolean per warning; the summarizer uses
it when present.

---

## structurelint-report.json

Emitted by the Structurelint JS API (`validate()`/`format(result)`), not a
native CLI formatter. `violations` is flat — no per-file grouping — since a
structure violation names a path directly.

```json
{
  "passed": false,
  "root": "src",
  "violations": [
    {
      "path": "src/components/button.tsx",
      "type": "unexpected",
      "message": "Unexpected entry \"button.tsx\" in \"components\".",
      "expected": ["{PascalCase}.(ts|tsx)"]
    }
  ]
}
```

`type` is `unexpected` (an entry matched no rule) or `missing` (a `required`
rule had no match — `path` then names the owning folder, not a nonexistent
file). `expected` lists the rule name patterns that were allowed/required at
that location. No key carries an auto-fix; every violation needs a manual
move/rename/create. `violations` empty ⇒ `passed: true`.

---

## skillslint-report.json

Emitted by the Skillslint JS API (`lint()`), not a native CLI formatter. Two
finding kinds live side by side: `textlint` prose problems (one entry per scanned
`SKILL.md`, with textlint messages) and `skills` quality scores, where
`passed: false` means a skill fell below its configured threshold.

```json
{
  "passed": false,
  "fixed": false,
  "skills": [
    {
      "name": "my-skill",
      "scores": {
        "overall": 40,
        "structure": 60,
        "clarity": 30,
        "specificity": 55,
        "advanced": 50
      },
      "passed": false
    }
  ],
  "textlint": [
    {
      "filePath": "/abs/path/skills/my-skill/SKILL.md",
      "messages": [
        { "ruleId": "common-misspellings", "severity": 2, "line": 12, "column": 4, "message": "…" }
      ]
    }
  ]
}
```

textlint `severity` follows ESLint's convention (`2` error, `1` warning). When
`--fix` ran, `fixed` is `true` and `messages` holds the problems that remained
unfixable.
