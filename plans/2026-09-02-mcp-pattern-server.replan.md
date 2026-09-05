# Parked replan — MCP pattern server, Python → TypeScript

**Status:** settled, not executed. Phase 1 (grill) is complete; Phases 2 and 3
have not run and `2026-09-02-mcp-pattern-server.md` has **not** been rewritten.

**To resume:** `/qoq replan plans/2026-09-02-mcp-pattern-server.md`. Hand the
"Settled" section below to the grill as already-answered so its frontier opens on
whatever has moved since, rather than re-asking four rounds this file already
holds. Everything not listed under "Reopened" is carried forward verbatim from
the Python plan and is not up for discussion.

## Already done, in the tree

- `1edeaaf` (ticket 1.1, the Python seed loader) is **reverted** by `7a48d86` —
  `mcp/` is gone, and so are its `.gitignore` / `.prettierignore` entries. The
  plan file still records ticket 1.1 as `done` against `1edeaaf`; that status is
  now false and the replan clears it. **No milestone is frozen** — the whole plan
  is live.
- The plan file's `Plan status` was moved to `draft` so `qoq execute` cannot
  select it and start dispatching Python tickets.

## Reopened by the language switch — settled

| Decision            | Answer                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace           | `mcp/` stays **outside** the npm workspace, and is **standalone**: own `package.json`, **committed `package-lock.json`**, own `tsconfig`, own vitest config, own install   |
| Validation          | **`zod`** v4 `strictObject` replaces pydantic. `SeedError` still names the file and the field                                                                              |
| YAML                | **`yaml`** v2 (eemeli) for parsing. The one-shot port still hand-builds block scalars by string concatenation — never any `stringify`                                      |
| SQLite              | **`node-sqlite3-wasm`**. `node:sqlite` is impossible — see below                                                                                                          |
| Server              | SDK's **`createMcpExpressApp()`** + `StreamableHTTPServerTransport({ sessionIdGenerator: undefined })`. The process binds its own port; there is no ASGI equivalent        |
| Binding             | `HOST` / `PORT` / `ALLOWED_HOSTS` / `DB_PATH` from env. Defaults to `127.0.0.1`, which turns the SDK's DNS-rebinding protection on                                         |
| Build               | `rolldown` + `tsc --emitDeclarationOnly` → `mcp/bin/`, mirroring `packages/cli`'s own build script. `render.ts` is **excluded from the build** — a dev-only entry point    |
| Version stamp       | `sync-plugin-version.js` gains a third target: `mcp/src/version.ts`'s `API_VERSION` literal, patched by regex and asserted. `release.config.js`'s git assets gains it      |
| `mcp/package.json`  | `version` stays `0.0.0` and is never read. One stamped literal, one thing to get wrong                                                                                     |
| Tests               | vitest inside `mcp/`, run by a **`test:mcp`** script wired into `husky:pre-push` — mirroring what `test:skill` already does. **`npm test` is untouched**                   |
| Lint                | `qoq.config.js` gains `qoq-eslint-v9-ts` over `mcp/src/**/*.ts` and `qoq-eslint-v9-ts-vitest` over `mcp/src/**/*.spec.ts`. Lands in **Milestone 1**, not retrofitted later |
| Knip                | widened to `mcp/src/**`, declaring four entry points — `server.ts`, `build.ts`, `render.ts`, the one-shot port. The latter three are npm-script-invoked, never imported     |
| Deploy              | **out of scope entirely.** Tickets 5.1 (Woodpecker), 5.2 (systemd) and 5.3 (nginx) are **deleted**                                                                        |
| `patterns.db`       | built by the container at install time, via `mcp/`'s own build script. Never committed, never a CI artifact, never copied to an artifacts directory                       |
| Renderer            | stays in `mcp/src/render.ts`, sharing `loadSeeds`. `render(seedRoot, templateRoot, outRoot)` already takes every path as a parameter, so nothing in `mcp/` names `skills/` |

### The deployment target

A single Docker container, owned elsewhere, clones this repo, takes whatever is
in `mcp/`, and serves it under pm2 alongside MCP servers extracted the same way
from other repositories. It assumes only the plain npm convention:

```
npm ci  &&  npm run build  &&  npm start
```

That is the whole contract, and Milestone 5 becomes writing it down and
conforming to it — the scripts, the committed lockfile, the env surface, and a
`mcp/README.md` stating what the container gets. This repo's `.woodpecker.yml`
is **not** touched.

## Facts established while grilling — don't re-derive these

- **`node:sqlite` cannot do FTS5, on any Node version.** Verified locally on
  Node 22.15.0 (SQLite 3.49.1): `PRAGMA compile_options` carries no
  `ENABLE_FTS5`, and `CREATE VIRTUAL TABLE … USING fts5` fails with
  `no such module: fts5`. Official Node builds never compile it in. Python's
  stdlib `sqlite3` does, which is the single thing that made Milestone 2 free
  before and does not any more.
- **`node-sqlite3-wasm` 0.8.60** carries `fts5` and `bm25` in its shipped
  `.wasm` (1.3MB), needs no node-gyp, and works on `node:22-alpine` unchanged.
  Its `new Database(path, { readOnly: true, fileMustExist: true })` is the exact
  equivalent of the plan's `mode=ro` open-by-path — no `immutable` caching trap,
  so the atomic-swap property survives.
- **`better-sqlite3` was rejected**: on Alpine musl it compiles from source,
  which means adding `python3 make g++` to the image — installing Python to
  build the SQLite driver for a migration away from Python.
- **The SDK (1.30.0) already depends on `express` ^5.2.1, `hono`, `cors` and
  `zod` ^3.25||^4**, and ships `server/express.js` exporting
  `createMcpExpressApp()`. That first-party helper *is* the MCP framework layer,
  and it applies DNS-rebinding host-header validation automatically on localhost
  binds. A hand-rolled `node:http` listener would have to reimplement that or
  ship without it.
- **Third-party MCP frameworks were considered and rejected**: `fastmcp`
  (4.20.2), `xmcp`, `mcp-framework`, `mcp-handler`, `@hono/mcp`. What `fastmcp`
  adds over the SDK — auth, session management, OpenAPI→MCP, image/audio
  resources, progress notifications, streaming output, custom REST routes, a CLI
  — is the exact list of things this server deliberately does not have. Two
  read-only tools, no auth, no sessions, no state.
- **`mcp/` gets no ESLint under today's `qoq.config.js`.** Its eslint blocks are
  scoped to `skills/**` and `packages/**/src/**`; Prettier's `sources: ['.']`
  does reach it. Untreated, `qoq fix` — gate 1 on every ticket — would be a
  formatter-only no-op over the server's TypeScript.
- `structurelint`'s `structureRoot` is `packages`, and it requires
  `AGENTS.md` / `CLAUDE.md` / `LICENSE` / `README.md` per directory. That is one
  more reason `mcp/` is not `packages/mcp`.

## Carried forward unchanged — not re-litigated

The seed record contract and its derived `name` / `asset_path`. 21 patterns and
22 index entries, Strategy owning two. The SQL schema, `sorted(glob('*.sql'))`
migration order, the ledger-less rebuild, and the atomic rename on build. Both
tool payloads, `found: false` with `closest` rather than an error, and the
`api_version` / `api_major` envelope. The byte-identical render, `examples[0]`
only, and the render → `prettier --write` → `git diff --exit-code` gate. The
plan-1 / plan-2 scope boundary, and CLAUDE.md's documentation triple.

`2026-09-02-mcp-pattern-server.next.md` — plan 2's prompt — needs two edits when
it is eventually run: `mcp/src/qoq_mcp/__init__.py` becomes `mcp/src/version.ts`,
and its claim that plan 1 delivered a deploy is no longer true.

## Accepted risk, recorded deliberately

**Nothing about `mcp/` runs in CI.** The render gate, the server's tests and its
lint live only in `husky:pre-push` — a local hook, absent on a clone that never
ran `npm install`, and skipped by `--no-verify`. The failure the gate exists to
catch is a seed edited without regenerating, which is exactly the kind of change
made in a hurry. This was put to the user and chosen; it belongs in
`docs/qoq-design.md` when the replan lands, so it reads as a decision rather than
an oversight.
