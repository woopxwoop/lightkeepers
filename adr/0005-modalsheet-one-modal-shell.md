# ADR-0005: One modal shell (`ModalSheet`) with one fixed look

- **Status:** Accepted (2026-11-14), after the owner asked to standardize the modals on 2026-11-13
- **Decider:** repo owner
- **Enforced by:** architecture test (only `ModalSheet`, `HoverTooltip`,
  `NavMobileDrawer` may use the focus-trap / scroll-lock helpers)

## Context

Thirteen modals and sheets each carried a copy of the same shell: backdrop,
focus trap, Escape handling, scroll lock, focus restore, transitions — and ~18
slightly different styling variables.

## Decision

Every modal or sheet renders through `src/lib/ui/components/ModalSheet.svelte`.
It has one fixed look (page-base background, cream hairline, shadow), two
sizes (`size="dialog"` 32rem, `size="sheet"` 72rem × 88vh), `nested` for
stacking above another modal, `closeDisabled` while a choice is in flight, and
no per-modal chrome overrides. Layout-level sheets mount through
`LoadOnFirstOpen` with `|global` transitions so the first open animates.

## Consequences

- Focus, keyboard and scroll behaviour are fixed in one place.
- A modal that needs a different look is a change to the standard, not a local
  override.
- Size rules use child combinators (`.modal-root.sheet > .modal-panel`):
  modals can render inside other modals.
