# `qoq fix` — the check/fix loop

Tool findings only: Prettier, ESLint, Knip, JSCPD, and whatever else the project
has enabled. Judgement calls are `refactor`'s. This is the command every other
one leans on, and it's the only one that invokes no other command.

## Scope

```
/qoq fix                                  # qoq.config's srcPath
/qoq fix src/auth/token.ts src/auth/token.spec.ts
```

Given files, the verdict is about those files and nothing else. That matters
because of who asks: `execute` needs to know whether _this ticket_ is clean and
`test` whether _this slice_ is, not whether the repo is.

Both of those callers dispatch a subagent to do the writing, so the gate runs one
thread up (`SKILL.md`). The scope and the retry budget both survive the move
intact, which is the only property that mattered.

## The checker

`qoq-checker` is dispatched at the top of every loop. It never edits: fixing is
this command's job, and an agent that can both report and fix will do both, which
loses the audit trail of what changed and why.

**Reports are reused only when they're demonstrably current**, and
`scripts/reports-current.mjs` is what decides — exit 0 reuse, exit 1 re-run.
Never decide it by eye: a stale digest read as current makes this command declare
PASS over code nothing checked.

**The check is `<run> <check>`** — two record lines concatenated. `check` carries
`--json`, which is not an optimisation: it is what writes the reports at all,
and without it the checker has nothing to summarise. Don't pass `--output` —
reports belong in the CLI's default directory, next to the record and with the
same lifetime, so `npm install` wipes both together and nobody has a second path
to agree on.

**The dispatch hands the checker three things it cannot derive**: the absolute
paths to `scripts/reports-current.mjs` and `scripts/summarize.mjs` in this skill,
and the report directory. Neither script defaults an argument — both exit 2 when
called bare.

## Verifying a fix

Two checks, answering different questions.

1. **The owning tool.** An ESLint finding is verified by re-running ESLint, a
   Prettier finding by Prettier. Not the whole suite — the full re-check is the
   _next_ `qoq-checker` at the top of the loop, and that's what catches
   cross-tool damage: a Prettier rewrite reopening an ESLint rule, a deleted
   export turning up in Knip.

2. **The scoped check.** The owning tool says the finding is gone; it says
   nothing about whether the code still works. So each fix is followed by
   `test:one` on the files it touched — the ones that have tests — plus `build`.
   Failing means revert **that fix** and carry it as unfixable, rather than
   leaving a green linter sitting on top of broken code.

`build` isn't scoped, because there's no such thing as a scoped build and a fix
that breaks the type graph shows up nowhere else.

An unfixable finding is **never retried**. It stays in the digest — the checker
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

It doesn't delegate the fixing. `qoq-checker` reports; this command edits. Never
dispatch an agent per finding.

It also doesn't ask before applying. A lint rule is not a matter of taste, which
is exactly what separates this command from `refactor`.
