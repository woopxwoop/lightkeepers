# ADR-0007: Bound every upstream call; caches fail open

- **Status:** Accepted (2026-11-14)
- **Decider:** repo owner
- **Enforced by:** architecture test (Supabase only via `supabaseServer.ts`,
  Redis only via `valkey.ts`) plus unit tests of the helpers

## Context

On 2026-11-14 `/api/static` hung for minutes while other routes worked. One
Supabase request had stalled with no deadline, and `LRUCache.getOrSet`
coalesces every caller for a key behind one in-flight promise — so one stuck
query took the whole route down until the process restarted. Valkey commands
had no timeout either, and the rate limiter calls Valkey before every route.

## Decision

- `serverDb` fetches have a 20 s deadline (`withDeadline` in `cdn-fetch.ts`).
  It aborts with an `AbortError` so postgrest-js treats it as final instead of
  retrying a stalled GET three more times.
- Valkey commands are bounded at 1 s (`withinOr` in `server/bounded.ts`) and
  fail open: a stalled GET is a cache miss, SET is skipped, rate limiting falls
  back to the in-process limiter.
- `LRUCache` warns when a fill is still pending after 5 s (with the phase it's
  in) and logs slow fills split into Valkey vs compute time.

## Consequences

- A stall degrades to an error or a miss within seconds, then the next request
  retries.
- New upstream clients must go through these modules (or add their own
  bound) — a second client would bypass the deadline.
- If a route stalls, check the `[cache]` / `[valkey]` warnings first.
