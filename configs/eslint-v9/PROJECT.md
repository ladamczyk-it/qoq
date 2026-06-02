# Project structure and design

All Eslint v9 templates needs to export `baseConfig` and inherit settings from base ones eg:

- any JS template needs to extend [@ladamczyk/qoq-eslint-v9-js](https://www.npmjs.com/package/@ladamczyk/qoq-eslint-v9-js)
- any TS template needs to extend [@ladamczyk/qoq-eslint-v9-ts](https://www.npmjs.com/package/@ladamczyk/qoq-eslint-v9-ts) (that is also extending base JS)
