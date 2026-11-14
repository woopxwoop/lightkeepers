# ADR-0009: Stores — one module per concern, explicit coordination

- **Status:** Accepted (2026-11-14)
- **Decider:** repo owner
- **Enforced by:** review; architecture test (no barrels, one
  `charactersOwned` writer, one `/api/static` caller)

## Context

`stores.ts` had grown to 902 lines and 51 exports across unrelated concerns.
Splitting it created an import cycle: version changes must invalidate teams
and refetch boards, while teams and boards both read the versions.

## Decision

Stores live in `src/lib/stores/`, one module per concern (`preferences`,
`roster`, `boards`, `teams`, `tierlist`, `versions`), with no barrel.
Cross-store reactions are explicit calls from the module highest in the
import graph — `setVersionNumbers()` in `boards.ts` writes the numbers, then
invalidates roster reads and marks boards stale, in a visible order. No
"register a callback" hooks to dodge cycles; `versions.ts` stays a leaf.

## Consequences

- Behaviour doesn't depend on which modules happen to be loaded.
- The coordinating function is the only public way in for its concern (here,
  the only public version setter).
