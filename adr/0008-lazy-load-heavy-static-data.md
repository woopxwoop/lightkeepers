# ADR-0008: Heavy static data loads on demand

- **Status:** Accepted (2026-11-14)
- **Decider:** repo owner
- **Enforced by:** architecture test (static JSON only via
  `equipment-data.ts`) plus `weapon-data-sync.test.ts`

## Context

Weapon and artifact tables are hundreds of KB. `weapons.json` alone was the
largest client chunk (~425 KB), and ~80% of it was refinement text only
tooltips read.

## Decision

Static game data loads through `equipment/equipment-data.ts` in on-demand
groups: base equipment (`ensureEquipmentData`, started by components that show
equipment), base stats (`ensureBaseStatData`, stat sheets only), and weapon
refinement text (`ensureWeaponRefinements`, started when a tooltip first
opens). The server loads equipment once at startup for SSR. `weapons.json` is
the pipeline's output; `weapon-index.json` / `weapon-refinements.json` are
derived by `pnpm data:split-weapons` and never edited by hand.

## Consequences

- Pages without equipment download none of it; weapon pages fetch ~83 KB.
- The data pipeline must run the split after refreshing `weapons.json`; a sync
  test fails in CI if it doesn't.
- Components read equipment through leaf helpers (`useWeapon`,
  `useEquipmentData`), never `weaponByKey` directly.
