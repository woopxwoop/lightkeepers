# Architecture decision records

One short file per decision that shapes how this codebase looks: what was
decided, why, and what it costs. Rules in `ARCHITECTURE.md`, the agent docs,
and `src/lib/architecture.test.ts` should cite the ADR they come from.

**Status is the owner's call.** Anyone (including an agent) may write a
**Proposed** ADR; it becomes **Accepted** only when the repo owner says so. A
rule with no accepted ADR behind it is a suggestion, not a convention.
Superseded ADRs stay, marked **Superseded by ADR-NNNN**.

New ADR: copy [`template.md`](template.md) to the next number, keep it under a
page, and add it to the table.

| #                                                       | Decision                                              | Status   |
| ------------------------------------------------------- | ----------------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)           | Record architecture decisions                         | Accepted |
| [0002](0002-one-entry-point-per-concern.md)             | One entry point per concern ("lanes")                 | Accepted |
| [0003](0003-domain-folders-in-lib.md)                   | `src/lib` grouped by domain                           | Accepted |
| [0004](0004-errors-become-responses-via-helpers.md)     | Errors become responses through shared helpers        | Accepted |
| [0005](0005-modalsheet-one-modal-shell.md)              | One modal shell (`ModalSheet`) with one fixed look    | Accepted |
| [0006](0006-component-size-budget.md)                   | Components stay under 600 lines (budget ratchet)      | Accepted |
| [0007](0007-bound-every-upstream-call.md)               | Bound every upstream call; caches fail open           | Accepted |
| [0008](0008-lazy-load-heavy-static-data.md)             | Heavy static data loads on demand                     | Accepted |
| [0009](0009-stores-one-module-per-concern.md)           | Stores: one module per concern, explicit coordination | Accepted |
| [0010](0010-enforce-checkable-rules-in-tests.md)        | Checkable rules live in tests; judgment rules in docs | Accepted |
| [0011](0011-verify-refactors-by-computed-style-diff.md) | Verify visual refactors by computed-style diff        | Accepted |
