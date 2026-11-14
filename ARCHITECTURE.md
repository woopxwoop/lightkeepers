# Architecture

How Lightkeepers is put together, and where new code goes. If you're adding
something, read **Lanes** and **Recipes** first: most work extends an existing
lane rather than opening a new one.

## The app in one paragraph

A SvelteKit 3 app that suggests Genshin Impact endgame teams for **Spiral
Abyss** (2 halves) and **Stygian Onslaught** (3 fields) from the player's
roster, plus pull suggestions, character kits/builds, investment sims, a tier
list, and an upgrade planner. The roster lives in `localStorage` first; signing
in (Google/Discord via Better Auth) syncs it to Postgres. The browser never
talks to the database directly — everything goes through the app's own `/api/*`
routes, so service keys and caches stay on the server.

## Layout

```
src/
  routes/            pages + API routes (src/routes/api/*)
  lib/
    equipment/       weapon/artifact tables, build stats (lazy-loaded data)
    roster/          roster cards, inventory, GOOD import/export, audit grades
    planner/         upgrade goals, itinerary, upgrade costs
    boards/          team solver, board helpers, tier list, pull suggestions
    characters/      kits, builds, Traveler kits, rotations, TCG cards
    investment/      investment sims and build cards
    research/        dev-only research assistant helpers
    patch-notes/     patch-note catalog + "seen" state
    stores/          client stores, one module per concern
    app/             client bootstrap, roster/goals sync, chunk recovery
    sync/            synced-document engine behind roster/goals sync
    server/          server-only: auth, DB, caches, CDN loaders, validation
    ui/              components (+ ModalSheet), icons, focus/scroll helpers
    api/  types/  data/  e2e/  assets/
    utils.ts definitions.ts site.ts asset-urls.ts cdn-fetch.ts
    query-state.ts nav-history.ts auth-client.ts   ← cross-domain basics only
tests/               Playwright end-to-end specs
```

A new module goes in its domain folder with its test beside it
(`foo.ts` + `foo.test.ts`). File names keep their domain prefix
(`#lib/equipment/equipment-data.js`), so they stay greppable.

## Data flow

```
Postgres (Supabase)
  ├─ layout SSR            → characters + current version numbers
  ├─ GET  /api/static      → meta teams, enemies, schedules (CDN + L1 + Valkey caches)
  ├─ POST /api/teams       → teams the roster can field
  ├─ POST /api/nearmiss    → pull suggestions
  ├─ GET  /api/tierlist    → tier list
  ├─ /api/roster, /api/roster/{weapons,artifacts}, /api/calculator-goals
  │                        → sign-in-gated account data
  └─ /api/auth/*           → Better Auth

CDN (api.lightkeepers.moe) → kits, builds, investment sims, images
  └─ proxied by /api/investment, /api/character-*, /api/tcg-cards, /api/upgrade-costs
```

On the client, `bootstrapClient` seeds the version numbers and roster, warms the
meta boards, and starts roster sync. Everything heavier loads on demand from
the page that needs it (owned teams, investment data, GOOD inventory, equipment
tables).

## Lanes: one entry point per concern

Each concern has exactly one way in. A second way to load the same thing is a
bug even if it works — it's how caches, versions, and stores drift apart.

| Concern                            | Entry point                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Meta boards + version numbers      | `ensureStaticBoards()` / `setVersionNumbers()` in `stores/boards.ts`                                         |
| Owned teams, near-miss pulls       | `ensureTeamsOwned()` / `ensureNearMissTeams()` in `stores/teams.ts`                                          |
| Weapon/artifact data in UI         | `useWeapon()` / `useEquipmentData()` (`equipment/equipment-data.svelte.ts`) + lookups in `equipment-data.ts` |
| Static game JSON (`src/lib/data/`) | only through `equipment/equipment-data.ts`                                                                   |
| Roster reads/saves                 | read `charactersOwned`; save via `rosterSync().commit()` (`app/roster-sync.ts`)                              |
| Planner goals                      | `goalsSync()` (`app/goals-sync.ts`)                                                                          |
| GOOD inventory                     | `loadRosterWeapons()` / `loadRosterArtifacts()` (`roster/roster-inventory.ts`), on demand                    |
| Roster-keyed DB reads (server)     | `require*` validators → `cachedRosterRpc()`                                                                  |
| Public CDN JSON (server)           | a `#lib/server/*` loader → `loadFromCdn()`                                                                   |
| Signed-in DB access (server)       | `requireUser()` + `assertNoDbError()`                                                                        |
| Characters table (server)          | `loadCharacters()` (`server/characters.ts`)                                                                  |
| Modals and sheets                  | `ModalSheet.svelte`                                                                                          |

## Recipes

**Add an API route.** A handler reads as a list of requirements, then a
response — no inline `try`/`catch`, type checks, or cache plumbing:

```ts
await enforceApiRateLimit({ request, getClientAddress });
const body = await requireJsonObject(request);
const characters = requireCharacterNameIds(body.characters);
await requireSupportedAbyssAndStygianVersions(abyssVersion, stygianVersion);
const rows = await cachedRosterRpc({
  cacheName,
  versionNumber,
  characters,
  run,
});
return Response.json({ rows });
```

Validators live in `server/validation/` (`core.ts` for shared primitives, one
file per domain: `roster`, `goals`, `stygian`, `research`). Add yours to its
domain file.

**Proxy new CDN JSON.** Write a loader in `src/lib/server/` (fetch + L1/Valkey
cache), call it from the route through `loadFromCdn()`, and return
`Response.json(payload, { headers: PUBLIC_CDN_CACHE_HEADERS })`. A 404 for a
missing entry stays visible in the handler.

**Add a modal or sheet.** Wrap the content in `ModalSheet` — it owns the
backdrop, focus trap, Escape, scroll lock, and transitions:

```svelte
<ModalSheet
  open={$fooOpen}
  onclose={() => fooOpen.set(false)}
  label="Foo"
  size="dialog"
>
  {#snippet head()}<h2 class="section-title">Foo</h2>{/snippet}
  …content…
</ModalSheet>
```

`size` is `"dialog"` (32rem) or `"sheet"` (72rem × 88vh); pass `nested` when it
opens over another modal. There are no per-modal style overrides. If it's a
layout-level sheet, mount it with `<LoadOnFirstOpen>` so its code loads on first
open.

**Show a weapon or artifact.** Use the leaf components (`WeaponIcon`,
`WeaponName`, `WeaponBadge`, `WeaponTooltip`, `ArtifactIcon`) or `useWeapon()`.
They load the equipment tables lazily and re-render when data arrives — no
`{#key}` wrappers in the caller.

**Add a store.** Put it in the matching `stores/` module (or a new one for a new
concern). No barrel file: import the module you need.

**Add a test.** Name it `*.test.ts` next to the module; `pnpm test:unit` picks up
every `src/**/*.test.ts` automatically. Change the solver? Extend
`boards/solver.test.ts`.

## Conventions

- **Imports:** in-repo imports use `#lib/...` with a file extension. Same-folder
  `./x` imports are fine; `../` out of a folder is not.
- **Components:** props → `$derived` → markup. Lazy-data reactivity lives in leaf
  components, not their callers.
- **Algorithms stay imperative inside** (`solver.ts`'s greedy pass, `LRUCache`),
  with a small declarative public surface.
- **Styling:** tokens and shared classes are in `src/app.css` (`.section-title`,
  `.page-title`, `.text-link`, `.board-section`, …) — reuse them, don't redeclare
  them in a component. Cream hairlines on mid surfaces; never gold text on the
  black page background.
- **Generated files** — `src/lib/types/database.types.ts`, `materialKey.ts`, and
  `src/lib/data/weapon-{index,refinements}.json` — are never edited by hand.
  Weapon JSON is regenerated with `pnpm data:split-weapons` after the data
  pipeline refreshes `weapons.json`.

## What's enforced automatically

`src/lib/architecture.test.ts` (part of `pnpm test:unit`, so it runs in CI)
fails the build when a lane rule is broken: static JSON imported outside
`equipment-data.ts`, a copied modal shell, a `#lib` barrel, server-only code
imported from client code, `../` or extensionless `#lib` imports, a second
writer to `charactersOwned`, or a second caller of `/api/static`. The messages
say what to use instead.

Also: `pnpm check` (types + Svelte), `pnpm dlx knip@5` (dead code), and the
Playwright suite in `tests/`.
