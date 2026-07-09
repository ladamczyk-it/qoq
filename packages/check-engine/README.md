# @ladamczyk/check-engine

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/ladamczyk-it/qoq/main.yml) ![NPM Version](https://img.shields.io/npm/v/%40ladamczyk%2Fcheck-engine)
![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ladamczyk%2Fcheck-engine) ![NPM License](https://img.shields.io/npm/l/%40ladamczyk%2Fcheck-engine)

## Rationale

To catch Node version mismatches before they cause runtime failures, **check-engine** validates that a package's own `engines.node` field is actually compatible with the `engines.node` requirements declared by its dependencies — and does so across every workspace in a monorepo, not just the root. It also reports the current and maintained Node LTS versions on each run for reference.

## Available options

CLI has its own documentation just run `check-engine -help` or `check-engine -h`.

### Last but not least

_Feel free to join us, please read [General Contributing Guidelines](https://github.com/ladamczyk-it/qoq/blob/master/.github/CONTRIBUTING.md)_
