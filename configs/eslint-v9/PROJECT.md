# Project structure and design

All Eslint v9 templates need to export their own delta layer (typed `EslintLayer`, named
`<name>Layer`) plus a `configs.*` `defineConfig` array composing the chain they belong to:

- any JS template composes [@ladamczyk/qoq-eslint-v9-js](https://www.npmjs.com/package/@ladamczyk/qoq-eslint-v9-js)'s `jsLayer`
- any TS template composes that same `jsLayer` followed by [@ladamczyk/qoq-eslint-v9-ts](https://www.npmjs.com/package/@ladamczyk/qoq-eslint-v9-ts)'s `tsLayer`

Always compose from other packages' **delta layers**, never from their already-composed
`configs.*` — `defineConfig` does not dedupe diamond extends, so a nested `configs.*`
re-applies the JS base mid-chain. Each package's `layer composition order` spec asserts
the resolved chain and fails when this is violated.
