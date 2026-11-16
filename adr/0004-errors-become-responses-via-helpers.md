# ADR-0004: Errors become responses through shared helpers

- **Status:** Accepted (2026-11-14) — replaces the earlier undated rule "no inline
  `try`/`catch` in route handlers"
- **Decider:** repo owner
- **Enforced by:** review only (deliberately not CI — see Consequences)

## Context

Route handlers that map errors themselves tend to return `err.message` to the
client (leaking internals) or pick their own status codes, so the same failure
gets different responses on different routes. The earlier wording banned the
keyword `try`, which is a proxy: it flags legitimate uses (a health probe,
best-effort cleanup) and misses the real problem (a `.catch()` that returns
the error text).

## Decision

API route handlers are a sequence of requirements, then a response. Failures
become responses through the shared helpers:

- bad input → a `require*` validator in `server/validation/` (400)
- database error → `assertNoDbError` (logged server-side, generic 500)
- CDN / upstream failure → a `#lib/server/*` loader + `loadFromCdn` (502)

No hand-rolled error mapping in a handler (no `err.message` in responses, no
ad hoc status choice). A `try` is fine when it isn't error policy — e.g.
`/api/health` reporting "degraded", or cancelling a response body.

## Consequences

- One policy per failure type; changing it means editing one helper.
- Judgment is required to tell policy from cleanup, so this stays out of the
  architecture test. Known routes that still map errors inline
  (`asset-proxy`, `static`, `research`) are candidates for cleanup, not
  violations to hide.
