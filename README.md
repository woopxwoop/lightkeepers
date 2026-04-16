# Lightkeepers (frontend)

SvelteKit frontend for **Lightkeepers** — roster-based team recommendations for **Spiral Abyss** and **Stygian Onslaught**.

This repository is intended to be **deployed** (not as an end-user local install guide).

## Tech stack

- **SvelteKit** (Svelte 5) + **Vite**
- **Tailwind v4**
- **Supabase** (server-side RPC; browser uses API routes only)
- **Sentry** (optional; production observability)
- **Prometheus metrics** at `GET /metrics` (optional; ops-only)

## Project structure (high-level)

- `src/routes/`: pages + API routes
- `src/lib/app/`: app bootstrap + dev tooling
- `src/lib/ui/`: UI shell + reusable UI components
- `src/lib/server/`: server-only utilities (Supabase server client, caching, metrics)
- `src/lib/api/`: client-side API helpers

## Data flow

- **Browser never calls Supabase directly** for data that needs caching or service role access.
- `src/routes/api/*` are the boundary:
  - `POST /api/teams`: roster → owned teams (abyss + stygian), cached + rate-limited
  - `POST /api/nearmiss`: roster → pull suggestions data, cached + rate-limited
  - `GET /api/static`: edge-cache-friendly “slow changing” payload (versions + all teams)
- `src/routes/+layout.server.ts` fetches `GET /api/static` and character list once per SSR render and passes it to the client for hydration.

## Environment variables

Required:

- **`PUBLIC_SUPABASE_URL`**
- **`PUBLIC_SUPABASE_KEY`**

Recommended for production:

- **`PRIVATE_SUPABASE_KEY`** (service role; server-only)
- **`PUBLIC_SENTRY_DSN`** (optional)

Build-time (if using Sentry source maps upload):

- **`SENTRY_AUTH_TOKEN`** (used by the Vite Sentry plugin)

## Docker build

The `dockerfile` expects build args for public env and secrets for private keys/tokens.

- **Build args**: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_KEY`, `SENTRY_DSN`
- **Secrets**: `PRIVATE_SUPABASE_KEY`, `SENTRY_AUTH_TOKEN`

## Observability

- **Metrics endpoint**: `GET /metrics` (Prometheus scrape)
- **Implementation**: `src/lib/server/metrics.ts`
- **Security**: restrict access at your reverse proxy / network boundary (do not expose publicly)
- **Sentry**: enabled via env + build token; intended for production deployments
