# ADR-0001: Record architecture decisions

- **Status:** Accepted (2026-11-14)
- **Decider:** repo owner
- **Enforced by:** review only

## Context

The agent docs (`CLAUDE.md`, `AGENTS.md`) and `/docs` are gitignored and local
to one machine. They state rules without saying who decided them or why. On
2026-11-14 a rule ("no inline `try`/`catch` in route handlers") turned out to
predate any decision the owner remembered — most likely an agent describing a
refactor pattern as a rule — and was nearly enforced in CI.

## Decision

Decisions that shape the codebase are recorded as numbered ADRs in `adr/`
(tracked). Agents may draft **Proposed** ADRs; only the owner marks them
**Accepted**. Docs and architecture-test messages cite the ADR a rule comes
from. A rule without an accepted ADR is treated as a suggestion.

## Consequences

- Rules carry their reason, so they can be applied (and challenged) correctly.
- Fresh clones, teammates, and cloud agents get the decisions, not just the
  code.
- Small cost: one short file per real decision. Routine refactors don't need
  one.
