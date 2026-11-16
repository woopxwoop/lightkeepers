# ADR-0010: Checkable rules live in tests; judgment rules in docs

- **Status:** Accepted (2026-11-14)
- **Decider:** repo owner
- **Enforced by:** `src/lib/architecture.test.ts` (runs in `pnpm test:unit`,
  so in CI)

## Context

Rules written only in agent docs were broken repeatedly — the docs are
local-only, and skills load only when an agent thinks they're relevant. The
repo has no ESLint; adding plugins for project-specific import rules is
heavier than needed.

## Decision

A rule that can be checked mechanically without exceptions becomes a rule in
the architecture test: a pure function over the source tree, a test that the
repo passes, and a test proving it fails on a planted violation. Its message
says what to do instead. Known legacy violations go on a shrink-only list
with a test that forces removal once fixed. Rules that need judgment (e.g.
ADR-0004) stay in docs and review. Unit tests are discovered by glob, so a
new test file always runs.

## Consequences

- Rules apply to every contributor and agent, whether or not they read docs.
- Don't encode a rule that needs an exception list to be correct — that's a
  sign it's a judgment rule.
