# Report schemas

The shape of each `*-report.json` that `qoq --json --output <dir>` writes. You
normally don't need this — `scripts/summarize.mjs` reads all of these for you and
prints a compact digest. Reach for a raw report only when one finding needs detail
the digest doesn't carry (a duplicated fragment's text, a precise export position),
and then read just that entry, not the whole file.

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

JSCPD's JSON reporter. `duplicates` is the list of clone pairs; `statistics.total.percentage`
is the overall duplication ratio to compare against `jscpd.threshold`.

```json
{
  "duplicates": [
    {
      "format": "typescript",
      "lines": 15,
      "tokens": 120,
      "firstFile": { "name": "src/a.ts", "start": 10, "end": 25 },
      "secondFile": { "name": "src/b.ts", "start": 40, "end": 55 },
      "fragment": "…the duplicated source text…"
    }
  ],
  "statistics": { "total": { "lines": 2000, "duplicatedLines": 30, "percentage": 1.5 } }
}
```

`fragment` is the only place the actual duplicated code lives — read it from here
when planning an extraction.

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
