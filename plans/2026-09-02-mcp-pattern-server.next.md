# Plan 2 prompt — skill integration

**Run this only after** `2026-09-02-mcp-pattern-server.md`'s Milestone 5 is delivered
and signed off: the live endpoint answers both tools, and `api_version` matches
`package.json`'s version. Plan 1 deliberately ships a server nothing calls; this is
the plan that gives it a caller.

Paste the block below as-is. It carries what plan 1 settled so `grilling` opens on
the real frontier instead of re-asking questions this repo already answered.

Note that by the time this runs, `.claude/qoq-estimator.json` will hold plan 1's
outcomes — so unlike plan 1, the estimator may actually move a tier. Take what it
returns.

---

```
/qoq plan wire the `qoq` skill to the MCP pattern server delivered by plan 1
(plans/2026-09-02-mcp-pattern-server.md). Plan 1 built the data, the database, the
server and the deploy; nothing calls it. This plan is consumers only.

## What plan 1 delivered — facts, not open questions
- `https://mcp.adamczyk.ovh`, streamable HTTP, stateless, no auth, nginx rate-limited.
- `lookup_pattern(smell_description, limit=5)` → index rows carrying
  `{name, pattern_name, stack, smell, cost, cheaper, asset_path, score}`. Rows are
  index *entries*, so `name`/`asset_path` repeat across rows (Strategy owns two).
  Never a body.
- `get_pattern(name)` — `name` is the stack-prefixed slug (`strategy`,
  `react/provider`) → the full record including every example. A miss is
  `found: false` with `closest`, never an error.
- Every response carries `api_version` (string) and `api_major` (int).
- `skills/qoq/assets/patterns/**` is now a generated render of
  `mcp/db/seed/patterns/`, CI-gated byte-identical on every push. Never hand-edited.
- `scripts/sync-plugin-version.js` stamps `mcp/src/qoq_mcp/__init__.py`'s
  `API_VERSION` at release, alongside `marketplace.json`.

## Settled during plan 1's grilling — do not re-litigate
- `qoq-designer` may call `lookup_pattern` and **never** `get_pattern`. Its
  anti-persuasion rule ("an agent that reads the Observer write-up before scanning
  starts seeing Observer everywhere") becomes a capability boundary rather than prose.
- `get_pattern` belongs to `refactor`'s main thread, which opens the write-up after
  the designer has named it.
- The plugin ships `.mcp.json` auto-registering the endpoint for every installer.
- Compatibility is **major-only**: minor/patch drift is normal and silent.
- The shipped markdown is the offline floor; the server is the upgrade. A user with
  no network still gets assessment 4.
- `api_version` is the npm workspace version — lockstep with the whole toolkit.

## What this plan has to settle
- Where `references/cli.yaml`'s `api_version` comes from, and what the skill compares
  it against — plan 1 stamped the server side only.
- What assessment 4 does when the server is unreachable, or when the majors differ.
  `qoq-designer` cannot ask the user, so how it reports a degraded run matters more
  than usual.
- Whether the designer still reads `assets/patterns/index.md` at all, or whether
  `lookup_pattern` replaces that read. It wants the *whole* index to hunt with, which
  is the case against.
- The lookup → get flow: the row carries `name`, so the chain should be direct —
  confirm nothing in `refactor.md` still tells the caller to open a path.
- What the refactor output tells the user when it ran against the shipped markdown
  rather than the server.
- Whether `qoq-designer`'s `tools:` frontmatter can carry an MCP tool at all, and what
  happens on the one run where the server is registered but the copy in
  `.claude/agents/` is stale.
- Whether `evals/qoq-evals.json` needs cases for the MCP path — it currently asserts
  the exact asset paths and the base/react index split.
- The docs triple: which `docs/qoq-workflows.md` diagrams change, and what belongs in
  `docs/qoq-design.md` versus the skill itself.

## Constraints
- CLAUDE.md's standing rule: skill prose, `docs/qoq-workflows.md` and
  `docs/qoq-design.md` move in the same commit, every direction.
- `skills/qoq/assets/patterns/**` is generated. Nothing in this plan hand-edits it.
- An agent that reports never fixes. The designer names patterns and never applies them.
- Nothing in this plan touches the seed corpus, the database, or the server.
```
