# Lightkeepers

[Lightkeepers](https://lightkeepers.moe) makes Genshin Impact’s endgame meta (Spiral Abyss, Stygian Onslaught) accessible — roster-aware team suggestions, pulls, character kits, and investment sims.

## Stack

SvelteKit 3 + TypeScript + Tailwind · Postgres (Supabase) · Better Auth · Valkey · Sentry / Grafana / Better Stack

## Develop

```bash
cp .env.example .env   # fill keys
pnpm install
pnpm dev
pnpm check
pnpm test:unit
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the layout, data flow, the one-entry-point-per-concern "lanes", and recipes for adding routes, modals, and tests.

- `src/routes/` — pages + API
- `src/lib/` — domain folders (`boards/`, `roster/`, `equipment/`, …), `server/` (server-only), `ui/`
- `scripts/` — data sync (separate tooling)

Inspired by [Lunaris](https://lunaris.moe/), [Genshin Optimizer](https://github.com/frzyc/genshin-optimizer), [Akasha](https://akasha.cv/), [Enka](https://enka.network/), [YShelper](https://app.yshelper.com/).
