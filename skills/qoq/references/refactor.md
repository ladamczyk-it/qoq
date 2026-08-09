# `qoq refactor` — green base, then four assessments

`fix` is the tool findings. This is the judgement calls, and it runs **after** the
tools are quiet, one assessment at a time.

## Scope

```
/qoq refactor                                   # everything under qoq.config's srcPath
/qoq refactor src/modules/npm src/helpers       # those paths only
```

Positional, like `fix` — the same concept spelled the same way in both commands.

The default comes from `qoq.config.js`'s `srcPath` — the project already declared
what its source is, and every other qoq tool respects it. Re-deriving it, or
defaulting to the repo root and dragging in `dist/` and fixtures, would be a
second answer to a settled question.

Given paths, it runs on **those only**. Four assessments over a large repo is a
lot of reading, and most refactoring intent is local: one module, one directory,
the thing you just touched. It's also what makes `bump`'s per-patch call
practical — it passes the patch's changed files, so each assessment reads a
handful of files instead of a project.

## Green base first

Open by dispatching `qoq fix` over the same scope, and refuse to start until it
comes back clean. Refactoring on top of live findings is guesswork — you can't
tell what your change did from what was already broken, and the next `qoq fix`
rewrites your work anyway.

Not green → **stop, don't ask.** `fix` already asked its own "keep going?" and
already reported what it couldn't solve; asking again about the same wall is
noise. The user fixes it or lowers the bar, then re-runs.

The base is scoped to the same paths. A `refactor src/modules/npm` that stops on
a finding in a file it will never touch is punishing the user for asking a narrow
question.

## The four assessments

| #   | Assessment                         | Reads                                    |
| --- | ---------------------------------- | ---------------------------------------- |
| 1   | **JSCPD, honestly**                | the duplication report                   |
| 2   | **this project's own conventions** | how the surrounding code already does it |
| 3   | **ponytail**                       | the `ponytail-review` lens               |
| 4   | **design-pattern-review**          | the `design-pattern-review` lens         |

**Sequentially, never in parallel.** They overlap by design — duplication is
often a missing pattern, and ponytail's answer to a pattern is often "delete it".
Run together they write conflicting patches into the same files. Each one reads
the tree the previous one left.

The order is cheapest-and-most-mechanical first, so the judgement-heavy passes at
the end look at a smaller, already-deduplicated tree.

**"Honest" JSCPD** is the whole point of the word: the report lies in both
directions. It hides real duplication under the configured threshold, and it
flags coincidental similarity that means nothing. Honest means judging each block
and saying out loud "this one isn't worth touching" — not editing code until the
number goes down.

**Assessment 2 is consistency, not catalogue.** It asks whether the code does
things the way the rest of _this_ codebase already does them: naming, module
shape, where errors are handled, how config is threaded through. Assessment 4
asks the different question of whether it's the right pattern at all — code can
be consistently wrong, or textbook and unlike everything around it.

Assessments 3 and 4 dispatch the lens skills named on the record's `skills:`
line. If one isn't available, say so and skip it — a missing lens is a reported
gap, not a reason to improvise a substitute pass.

## After each: approve, apply, re-green

1. **No findings → next assessment.** Nothing to say, nothing to ask.
2. **Findings → ask, always.** `fix` applies tool findings without asking because
   a lint rule isn't a matter of taste. These are: every one changes shape, not
   correctness, and that call belongs to the user. Approval is **per assessment**,
   never once up front for all four — the user who wants deduplication doesn't
   thereby want a pattern swap.
3. **Declined → next assessment, unchanged.** A no is an answer, not a retry.
4. **Approved → apply, then dispatch `qoq fix` again.** Reshaping code produces
   new formatting and lint findings, and the next assessment deserves the same
   green base the first one got. Cheap in practice: the checker's mtime scan
   short-circuits when nothing changed, so a re-green after an assessment that
   applied nothing costs a stat sweep.

Report everything at the end, per assessment — including the ones that found
nothing and the ones the user declined.

## `--decisions auto`

Two callers can't stop to answer four questions: `execute`'s milestone gate,
which runs with nobody watching, and `bump`, which would otherwise ask per patch
on top of its own sign-off. So the interactive behaviour above stays the default
and there's one flag.

|                                                                   | interactive _(default)_   | `--decisions auto`                            |
| ----------------------------------------------------------------- | ------------------------- | --------------------------------------------- |
| mechanical finding — formatting-shaped, one obvious rewrite       | asked about with the rest | **applied**                                   |
| judgement finding — a different shape, a pattern swap, a deletion | asked about               | **returned as an advisory, nothing changed**  |
| what the caller gets                                              | what it applied           | what it applied, plus every advisory verbatim |

The split is the same line `fix` and `refactor` already draw between them: a
finding with exactly one sensible resolution isn't a matter of taste; a finding
that changes shape is. `auto` doesn't lower the bar, it declines to guess.

**Advisories belong to whoever asked.** The milestone gate records them in the
milestone's `## Completed` summary; `bump` carries them into its per-package
report. An advisory that evaporates because nobody wrote it down is the failure
mode this flag is worth guarding against.
