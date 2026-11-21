# Next steps — fix/plan-unattended-grants

- **Eval 80 (`plan-unattended-grant-minimal-and-split`) is not graded.** The
  new-skill run finished; its output is in the session scratchpad
  (`ev80/new.json`, `ev80/new/plans/`), which a reboot clears. The old-skill
  baseline was killed. Re-run both (old skill = `git archive master skills/qoq`)
  on sonnet, grade on haiku, per `evals/README.md`'s fixture-repo steps.
- **`docs/qoq-workflows.md` chart at line 153 fails to parse on master** (from
  15453a82): a backtick inside the `CD["`cd <root>` …"]` label. Separate fix.
- Learning record 9 (run CI phases in order against a fixture) is still open;
  out of scope here.
- Delete this file once the above are done.
