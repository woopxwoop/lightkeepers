# Lightkeepers 

[Lightkeepers](https://lightkeepers.moe) is a website dedicated to making Genshin Impact's meta accessible to all.

## Tech stack
- **SvelteKit + TypeScript + Tailwind** 
- **Postgres** (currently managed by supabase)
- **Sentry, Grafana, BetterStack** 

## Project structure 

- `src/routes/`: pages + API routes
- `src/lib/app/`: app bootstrap + dev tooling
- `src/lib/ui/`: UI shell + reusable UI components
- `src/lib/server/`: server-only utilities (Supabase server client, caching, metrics)
- `src/lib/api/`: client-side API helpers

Inspired by other Genshin projects such as [Lunaris](https://lunaris.moe/), [Genshin Optimizer](https://github.com/frzyc/genshin-optimizer), [Akasha](https://akasha.cv/profile/621003558), [Enka](https://enka.network/), [YShelper](https://app.yshelper.com/#/)
