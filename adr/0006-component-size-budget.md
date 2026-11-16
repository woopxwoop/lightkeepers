# ADR-0006: Components stay under 600 lines (budget ratchet)

- **Status:** Accepted (2026-11-14)
- **Decider:** repo owner
- **Enforced by:** architecture test (`componentSize`, with
  `LARGE_COMPONENT_BUDGETS`)

## Context

Seven files had grown past 1,000 lines (up to 1,928) and were the riskiest
places to change. Splitting them (November 2026) took each under 500 lines
with no visual change. A dozen files between 600 and ~1,000 lines remain.

## Decision

A `.svelte` file stays under 600 lines. Files already over it have a fixed
budget (their size when the rule landed): they may shrink but not grow, and
leave the list once under 600. To split a component: child components go in a
kebab-case folder named after it (`ui/components/roster-build-card/`), or
beside the route for page files; pure logic moves to a tested module in its
domain folder; the parent keeps its path and props.

## Consequences

- Big files can only get smaller; new big files can't appear.
- Splitting copies some scoped CSS into children (Svelte scopes per
  component); consolidate repeated clusters into a shared stylesheet owned by
  the feature (e.g. `research-answer/research-shared.css`), not `app.css`,
  when they only ship with that feature.
