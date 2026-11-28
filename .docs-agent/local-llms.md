qoq is the hub: skip the '- [qoq](https://qoq.adamczyk.ovh/)' line. Instead, after '## Docs', keep an '## Included tools' section with exactly one line per sibling tool qoq runs, in the form '- [<Tool>](https://<tool>.adamczyk.ovh/): <what qoq uses it for>. llms.txt: https://<tool>.adamczyk.ovh/llms.txt', worded from website/docs/configuration.md. Link each tool's site root, never https://adamczyk.ovh/docs/<tool>, which only redirects:

- Outdated: the advisory dependency check of qoq --check, throttled by npm.checkOutdatedEvery and skipped with --skip-npm; qoq npm --json writes its JSON report for the /qoq bump skill.
- Structurelint: optional blocking check of file and folder structure, enabled by a structurelint block in qoq.config.js.
- Skillslint: optional linting and 0-100 scoring of Agent Skills (SKILL.md), enabled by a skillslint block.
- Justify-disable: optional check that every eslint-disable and stylelint-disable carries a written @todo reason, enabled by justifyDisable.severity warn or error.
