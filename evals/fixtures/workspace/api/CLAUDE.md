# trips-api

The HTTP API behind the trips app: a `node:http` server in `src/index.ts`, the
trips routes in `src/trips/router.ts` over an in-memory store.

<!-- qoq:discovery -->

- test (full suite): `npm test`
- test (one file): `npm run test:one -- {file}`
- build: `npm run build`
- runner: vitest, globals off, no React

<!-- /qoq:discovery -->
