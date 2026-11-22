# `qoq fix` — the check/fix loop

Tool findings only: Prettier, ESLint, Knip, JSCPD, and whatever else the project
has enabled. Judgement calls are `refactor`'s. This is the command every other
one leans on, and it's the only one that invokes no other command.

## Scope

```
/qoq fix                                  # qoq.config's srcPath
/qoq fix src/auth/token.ts src/auth/token.spec.ts
/qoq fix --skip-knip <files>              # mid-milestone; see below
```

Given files, the verdict is about those files and nothing else. That matters
because of who asks: `execute` needs to know whether _this ticket_ is clean and
`test` whether _this slice_ is, not whether the repo is.

Both of those callers dispatch a subagent to do the writing, and the subagent has
already run the CLI's scoped form over its own files before handing them back
(`agents/qoq-developer.md`, `agents/qoq-tester.md`). This command is still the
gate: that form writes no reports, so the digest — and the retry budget that acts
on it — only exist here.

Scope is a property of the verdict, not of the invocation: `--check` takes no paths,
so a scoped `fix` runs the whole check and reports on the scope. The findings
outside it are somebody else's, and saying so is the whole answer.

### `--skip-knip`, and why one tool gets an opt-out

That works for every tool but one. Knip answers a whole-repo question — is this
export reachable — so scoping by reading the digest doesn't help: a finding about
a file _in_ scope is still computed from a repo where half the milestone doesn't
exist yet. Mid-plan, an export ticket 4 will consume looks exactly like dead code
to ticket 3, and the fix this command would apply is deleting it.

So `execute` passes `--skip-knip` on its per-ticket gate, and this command runs
the `ticket` form instead of `check`; everything else here is unchanged. **Carry
it into the verdict line** — `PASS — 0 findings across 4
tools (knip skipped)` — because a caller reading a bare PASS will believe dead
code was checked for.

Only a caller who knows the code is mid-flight may ask for it. A bare `/qoq fix`
never skips a tool on its own: with no next ticket coming, the finding is just
true.

## The check

At the top of every loop, run the `check` form in [cli.yaml](cli.yaml) yourself,
one Bash call (`ticket` when the caller asked to skip Knip), from the project
root. Write `<skill>` as the absolute path SKILL.md gives for it, never a relative
`.claude/skills/qoq`. A plugin install has no copy there, and `$CLAUDE_PROJECT_DIR`
isn't set in the shell. It runs the
project's `qoq:check`, reuses reports only when they're demonstrably current,
and prints the digest. Never run `npx qoq --check` or `npm run qoq:check` in its
place: you'd lose the reuse rules and the stale-report cleanup, and you'd get
thousands of report lines instead of a digest.

**Exit 0 is clean, exit 3 is findings, and anything else is no verdict**, never
PASS. 2 means the project has no `qoq:check`, the build failed, or the CLI
crashed. 1 means node couldn't start the script at all: a wrong path or a wrong
directory. A crash prints a partial digest under a `⚠` header,
and a tool with no section in it didn't run. Stop and report:

```
NO VERDICT — qoq CLI crashed (exit 2); eslint, knip have no report
```

**Read the digest, never a raw report wholesale.** If one finding needs a line
number, open that one report and read only that slice. Clone code is in no report;
read it from the source files at the digest's line ranges.

**The digest's first line quotes the script that ran.** A `--skip-<tool>` in it
is the project's choice: carry it into the verdict like `(knip skipped)`.

Auto-fixes go through the `fix` form, which is the project's `qoq:fix` run verbatim
(`fix_if_symlinked` when `symlink_test` holds).

## Verifying a fix

Two checks, answering different questions.

1. **The owning tool.** An ESLint finding is verified by re-running ESLint, a
   Prettier finding by Prettier. Not the whole suite — the full re-check is the
   _next_ check at the top of the loop, and that's what catches
   cross-tool damage: a Prettier rewrite reopening an ESLint rule, a deleted
   export turning up in Knip.

2. **The scoped check.** The owning tool says the finding is gone; it says
   nothing about whether the code still works. So each fix is followed by
   `test:one` on the files it touched — the ones that have tests — plus `build`.
   Failing means revert **that fix** and carry it as unfixable, rather than
   leaving a green linter sitting on top of broken code.

`build` isn't scoped, because there's no such thing as a scoped build and a fix
that breaks the type graph shows up nowhere else.

A JSCPD clone between a spec and its source is unfixable here: deduping breaks
the spec ([test-conventions.md](test-conventions.md#relaxations-in-test-files)),
and widening `jscpd.ignore` is a scope decision for a person. Carry it with the
missing glob as the reason.

An unfixable finding is **never retried**. It stays in the digest — the check
will keep reporting it — but the loop skips it from then on and lists it at the
end. Otherwise every subsequent loop re-attempts the same fix, re-breaks the same
test, and burns the budget on a known dead end.

## Why it loops

Fixes cascade — a Prettier rewrite reopens an ESLint rule, a Knip-driven
deletion makes another export unused. One pass is never the answer.

**Progress is announced, continuation is asked.** One line per loop:

```
loop 1  eslint 12 → 3, prettier 4 → 0     (13 fixed, 3 left)
loop 2  eslint 3 → 1, knip 0 → 2          (3 fixed, 3 left)
loop 3  eslint 1 → 0, knip 2 → 2          (1 fixed, 2 left)

3 loops, 2 findings left. Keep going?
```

Three loops is a **budget, not a limit** — a yes resets the counter rather than
buying one more pass, because the useful question is "is this still going
somewhere", not "have we hit ten".

**Stuck beats looping.** If a loop closes with the finding count no lower than it
opened with, stop and report instead of asking. The remaining findings need a
person, and asking "keep going?" about a loop that provably isn't going anywhere
is just a slower no.

## The verdict

`fix` ends on one line, with the digest underneath:

```
PASS — 0 findings across 4 tools
```

```
FAIL — 2 findings left after 3 loops (1 unfixable: knip/unused-export src/api/legacy.ts)
```

That line exists for the command's callers — `refactor`'s green base, `execute`'s
per-ticket gate, `test`'s per-slice gate. One line, same shape every time, so no
caller has to parse a digest to learn whether it can carry on.

## What `fix` doesn't do

It doesn't delegate the fixing or the checking. `check.mjs` reports; this command
edits. Never dispatch an agent per finding.

It also doesn't ask before applying. A lint rule is not a matter of taste, which
is exactly what separates this command from `refactor`.
