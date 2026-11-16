# ADR-0011: Verify visual refactors by computed-style diff

- **Status:** Accepted (2026-11-14)
- **Decider:** repo owner
- **Enforced by:** review (a procedure, not a check)

## Context

Type checks and unit tests pass while layout regressions slip through. In
November 2026 two only showed up in the browser: a nested dialog inheriting
its parent sheet's size, and a card losing its scrollbar inside a flex body.

## Decision

A refactor that should not change what users see is verified by comparing the
computed styles of every element on the affected page before and after:

- fixed viewport (e.g. 1280×900) and the same device pixel ratio for both
  captures;
- realistic content — seed browser data reversibly (snapshot `localStorage`
  first, restore after), or use `PLAYWRIGHT_E2E=1` fixtures when live data is
  unavailable, or a temporary dev page rendering the component from synthetic
  data (deleted afterwards);
- compare element count and per-element properties; sub-pixel or
  whitespace-only differences are noise, anything else is investigated.

## Consequences

- "Pure refactor" becomes a measured claim rather than an assumption.
- Interactive states (hover, edit modes) aren't covered by a static
  fingerprint and need a separate check when they change.
