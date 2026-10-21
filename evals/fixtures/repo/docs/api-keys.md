# Multi-tenant API keys

Each organisation can mint API keys for machine clients.

- An org admin mints a key and sees its secret exactly once.
- A key is scoped to a list of endpoints; a request to anything else is refused.
- A key can be rotated: a new secret is issued and the old one keeps working for a grace period.
- A key can be revoked, after which every request with it is refused.
- Requests authenticate with an `Authorization: Bearer <key>` header, checked by a new auth middleware.
- Every key has a usage counter: requests per day, visible to the org admin.

Open: how long is the rotation grace period? Do revoked keys count toward an org's key quota?
