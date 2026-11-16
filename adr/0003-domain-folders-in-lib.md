# ADR-0003: `src/lib` grouped by domain

- **Status:** Accepted (2026-11-14)
- **Decider:** repo owner
- **Enforced by:** review; architecture test enforces `#lib/...` imports with
  an extension and no barrels

## Context

By November 2026 `src/lib` held ~70 modules flat at the top level, which hid
which code belonged together and which lane owned what.

## Decision

`src/lib` is grouped by domain: `equipment/`, `roster/`, `planner/`,
`boards/`, `characters/`, `investment/`, `research/`, `patch-notes/`, plus
infrastructure folders (`stores/`, `server/`, `sync/`, `app/`, `ui/`, `api/`,
`types/`, `data/`). Only cross-domain basics stay top-level (`utils`,
`definitions`, `site`, `asset-urls`, `cdn-fetch`, `query-state`,
`nav-history`, `auth-client`). Tests sit beside their module. File names keep
their domain prefix (`#lib/equipment/equipment-data.js`) so they stay
greppable. No `index.ts` barrels.

## Consequences

- New modules have an obvious home; a module that fits no domain is a design
  question worth asking.
- Moves are done with a codemod that rewrites imports (wave 3 moved 96 files),
  not by hand.
