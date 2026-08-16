/**
 * Nested body scroll lock for stacked modals/sheets.
 * Unlock only after the last acquire is released.
 */

let lockDepth = 0;
let previousOverflow = "";

/** Lock document scrolling; returns a release that is safe to call once. */
export function acquireBodyScrollLock(): () => void {
  if (typeof document === "undefined") return () => {};

  if (lockDepth === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockDepth += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockDepth = Math.max(0, lockDepth - 1);
    if (lockDepth === 0) {
      document.body.style.overflow = previousOverflow;
      previousOverflow = "";
    }
  };
}
