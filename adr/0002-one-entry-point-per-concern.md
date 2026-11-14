# ADR-0002: One entry point per concern ("lanes")

- **Status:** Accepted (2026-11-14). The practice predates this ADR; it was documented in
  the local agent docs by 2026-10-23.
- **Decider:** repo owner
- **Enforced by:** architecture test (static data lane, roster store writer,
  `/api/static` caller, one Supabase / Valkey client) plus review

## Context

Boards, versions, equipment tables, roster data and caches each have subtle
invariants (version rollover, SWR staleness, lazy loading, cache keys). A
second code path that loads the same thing "works" but drifts: duplicate
fetches, stale data, two caches disagreeing.

## Decision

Each concern has exactly one entry point, and new work extends it rather than
opening a second path. The current lanes are listed in `ARCHITECTURE.md`
("Lanes"), e.g. boards → `ensureStaticBoards()`, equipment in UI →
`useWeapon` / `useEquipmentData`, roster saves → `rosterSync().commit()`,
public CDN JSON → a `#lib/server/*` loader + `loadFromCdn`.

## Consequences

- A second path for an existing concern is a regression even if it works.
- A genuinely new concern gets a named helper in the same change, not a
  one-off in a page.
- Lane entry points become load-bearing; changing one needs care (and tests).
