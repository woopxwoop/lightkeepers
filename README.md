# Lightkeepers

[Lightkeepers](https://lightkeepers.moe) makes Genshin Impact’s endgame meta (Spiral Abyss, Stygian Onslaught) accessible — roster-aware team suggestions, pulls, character kits, and investment sims.

## Stack

SvelteKit 5 + TypeScript + Tailwind · Postgres (Supabase) · Better Auth · Valkey · Sentry / Grafana / Better Stack

## Develop

```bash
cp .env.example .env   # fill keys
pnpm install
pnpm dev
pnpm check
pnpm test:unit
```

## Layout

- `src/routes/` — pages + API
- `src/lib/app/` — client bootstrap
- `src/lib/ui/` — shell + components
- `src/lib/server/` — auth, Supabase, cache, metrics
- `src/lib/solver.ts` / `board-solutions.ts` — team assignment + board helpers
- `scripts/` — data sync (separate tooling)

Inspired by [Lunaris](https://lunaris.moe/), [Genshin Optimizer](https://github.com/frzyc/genshin-optimizer), [Akasha](https://akasha.cv/), [Enka](https://enka.network/), [YShelper](https://app.yshelper.com/).
