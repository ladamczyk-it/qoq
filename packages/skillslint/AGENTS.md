# @saashub/skillslint — Agent Context

CLI linter for Claude Code agent skill documentation. Runs two checks: markdown prose quality via textlint, and structured quality scoring via `agent-skills-cli`.

## Command

```bash
skillslint [options]
```

| Option                  | Default    | Description                                                                      |
| ----------------------- | ---------- | -------------------------------------------------------------------------------- |
| `-p, --path <path>`     | `./skills` | Directory containing skill subdirectories                                        |
| `-t, --threshold <n>`   | `70`       | Overall quality threshold (0–100); used when no specific threshold flags are set |
| `--overall <n>`         | —          | Required overall score                                                           |
| `--structure <n>`       | —          | Required structure score                                                         |
| `--clarity <n>`         | —          | Required clarity score                                                           |
| `--specificity <n>`     | —          | Required specificity score                                                       |
| `--advanced <n>`        | —          | Required advanced score                                                          |
| `-f, --fix`             | —          | Attempt auto-fix via textlint                                                    |
| `-i, --ignored [names]` | —          | Skill directory names to skip                                                    |

Exits with code `1` if any skill fails to meet its threshold or if textlint finds unfixable issues.

## Skills directory structure

Each subdirectory under `--path` is treated as one skill:

```
skills/
  my-skill/
    SKILL.md     # the skill document linted by textlint and scored
```

## Scoring categories

| Category    | What it measures                           |
| ----------- | ------------------------------------------ |
| Overall     | Weighted average of all categories         |
| Structure   | Document organization and completeness     |
| Clarity     | Writing clarity and readability            |
| Specificity | Concrete examples and precise instructions |
| Advanced    | Use of advanced skill features             |

## Textlint rules (bundled `.textlintrc.json`)

- `common-misspellings` — catches common spelling errors
- `write-good` — passive voice and wordiness checks (weasel words, adverbs, and "too wordy" disabled)
