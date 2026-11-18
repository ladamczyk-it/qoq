# 1. Accept the legacy `Token ` authorization prefix

Date: 2026-03-02

## Status

Accepted

## Context

The v2 mobile clients send `Authorization: Token <token>`. They predate the move to
`Bearer`, and about a fifth of active installs still run them. The app stores
won't let us force an update before the v2 sunset on 2026-12-31.

## Decision

`authenticate` accepts both `Token <token>` and `Bearer <token>`, and verifies the
token the same way whichever prefix it arrived with. The `Token ` branch is
removed after the v2 sunset.

## Consequences

Two prefixes reach the same verifier, so a header with neither prefix is passed
through as a raw token. Removing the `Token ` branch early locks out every v2
install.
