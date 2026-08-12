/** Focusable controls inside a dialog panel (excludes tabindex="-1"). */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.getClientRects().length > 0);
}

/**
 * Cycle Tab / Shift+Tab inside `container`. Returns true when handled.
 */
export function trapTabKey(
  event: KeyboardEvent,
  container: HTMLElement,
): boolean {
  if (event.key !== "Tab") return false;

  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return true;
  }

  const active = document.activeElement;
  const currentIndex =
    active instanceof HTMLElement ? focusable.indexOf(active) : -1;

  event.preventDefault();
  if (event.shiftKey) {
    const prev =
      currentIndex <= 0
        ? focusable[focusable.length - 1]
        : focusable[currentIndex - 1];
    prev?.focus();
  } else {
    const next =
      currentIndex === -1 || currentIndex === focusable.length - 1
        ? focusable[0]
        : focusable[currentIndex + 1];
    next?.focus();
  }
  return true;
}
