---
name: lint
description: Run the `qoq --check` quality aggregator to surface lint/test/duplication findings, group issues by tool, propose fixes and optionally run `qoq --fix` to attempt auto-fixes. Use for repository health checks and pre-PR validation.
compatibility: Requires `node` and npm, network access to install `@ladamczyk/qoq-cli` if missing, and available test/build commands for validation.
user-invocable: true
---

## Purpose

This skill runs the `qoq` quality aggregator (`qoq --check`) to collect findings from configured tools (prettier, eslint, knip, jscpd, and optionally stylelint and `npm outdated`). It groups findings by tool and type, proposes concrete fixes for each issue category, and can attempt automatic fixes via `qoq --fix` when safe.

## When To Use (trigger)

- "run project lint checks"
- "check project quality with qoq"
- "group lint and duplication issues and propose fixes"

Trigger whenever you want a consolidated code-quality audit and suggested remediation plan.

## Mandatory Preparation

1. Ensure `@ladamczyk/qoq-cli` is installed or available via `npx`.
   - Install locally: `npm install --no-save @ladamczyk/qoq-cli` or globally if preferred.
2. Confirm presence of `qoq.config.js|cjs|mjs|ts` in repo root or run `qoq --init` to create one.
3. Ensure `npm ci` (or equivalent) and project build/test scripts are functional for validation steps.
4. Be aware checks may take several minutes on large repositories.

## Execution (step-by-step)

1. Verify `qoq` availability

- Prefer running `npx qoq --version` or `npx -y @ladamczyk/qoq-cli --version` to verify the binary.
- If not available, suggest `npm install --no-save @ladamczyk/qoq-cli` and then `npx qoq --init` to create a config.

2. Run the checks

- Execute:

```bash
npx qoq --check 2>&1 | tee qoq-check.log
```

- Capture raw output to `qoq-check.log` and, where supported by the environment, also save a machine-parsable file if `qoq` offers JSON output (e.g., `--json`).

3. Group findings

- Parse `qoq-check.log` and group results by tool:
  - `prettier`: formatting diffs
  - `eslint`: linting errors and rule names
  - `knip`: unused packages
  - `jscpd`: code duplication blocks by file and lines
  - `stylelint` (optional): style violations
  - `npm outdated` (optional): outdated dependencies

- For each tool, group issues by type (error/warning), file, and rule/id.

4. Attempt auto-fixes (optional)

- If user approves, run the aggregated autofix command which applies autofixes across all configured tools:

```bash
npx qoq --fix 2>&1 | tee qoq-fix.log
```

- `qoq --fix` will execute autofixers for Prettier, ESLint, Stylelint, and other configured fix-capable tools in one run — there is no need to run each tool's `--fix` separately unless you want a targeted fix.

- Re-run `npx qoq --check` to verify remaining issues.

- Record which fixes succeeded and which remain; do not commit changes automatically without user approval.

5. Propose fixes (by tool & type)

- `eslint`:
  - For non-fixable issues, propose specific code edits, refactors, or rule suppressions with examples.
- `knip`:
  - Mark unused dependencies and propose removal from `package.json` (show exact dependency keys and locations).
  - Validate removals by running `npm ci` and test/build commands.

- `jscpd`:
  - Identify duplication hotspots; propose refactors such as extracting shared utilities or consolidating test fixtures.
  - For each duplication block provide a suggested refactor location and brief patch idea.

- `stylelint`:
  - List offending rules and recommended config changes or code edits.

- `npm outdated`:
  - Delegate to the `bump` skill for safe bump recommendations; mark major bumps for manual review.

6. Produce report

- Generate `qoq-report.md` at repository root summarizing:
  - Tool-by-tool findings
  - Number of issues, grouped by severity
  - Suggested fixes and commands to apply them
  - Files and code snippets for manual edits
  - Recommended follow-up PR titles and descriptions

- Save raw logs: `qoq-check.log`, `qoq-fix.log` (if run).

## Safety & Validation

- Always validate removals (e.g., `knip` suggested) by running `npm ci` and the test suite. If tests fail, revert the removal and mark for manual investigation.
- Do NOT auto-commit major code changes or dependency removals without explicit user confirmation.
- When proposing config changes (ESLint, Prettier, Stylelint), include a rationale and example patch.

## Outputs

- `qoq-check.log` (raw)
- `qoq-fix.log` (if fixes attempted)
- `qoq-report.md` (human-readable grouped findings and suggested fixes)

## Example prompts to invoke this skill

- "Run qoq checks and suggest fixes"
- "Audit code quality and group findings by tool"
- "Run qoq --fix and report remaining issues"

## Notes / Questions for the user

- Do you want me to attempt automatic fixes (`qoq --fix`) after the initial audit?
- Policy: Should dependency removals suggested by `knip` be applied automatically if tests pass, or require human review?

---

If you want, I can now:

- verify `qoq` is installed and run `npx qoq --check`,
- generate `qoq-report.md` and group findings, or
- attempt `npx qoq --fix` and then re-run checks (I will not commit changes without your permission).
