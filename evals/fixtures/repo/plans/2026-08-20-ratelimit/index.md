# Rate Limiting Implementation Plan

**Goal:** Cap each client at a fixed number of requests per window and tell a throttled client when to retry.
**Architecture:** An in-memory fixed-window limiter keyed by client id, and a pure function that maps its result onto an HTTP status and headers. No framework binding — the caller wires it into its own handler.
**Requirements source:** "Rate-limit the public endpoints: N requests per window per client, 429 with Retry-After once over."
**Commands:** build `npm run build` · test `npm test`
**Plan status:** approved

## Milestones

| #   | Milestone                                                      | Status | Depends on | Summary                                                                                                            |
| --- | -------------------------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| M1  | [Fixed-window rate limiting](m1-fixed-window-rate-limiting.md) | todo   | none       | A caller can ask whether a client's request is allowed and get back the HTTP status and headers to answer it with. |
