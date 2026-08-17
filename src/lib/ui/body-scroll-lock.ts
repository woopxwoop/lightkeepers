/**
 * Nested body scroll lock for stacked modals/sheets.
 * Ownership is the depth counter plus an explicit body marker — never inferred
 * from overflow being "hidden". Only this module writes body overflow for locks.
 */

const OWNER_ATTR = "data-lk-body-scroll-lock";

let lockDepth = 0;
/** Inline overflow captured when we first took ownership; restored on last release. */
let savedOverflow = "";

function takeOwnership(): void {
  // Stale marker (e.g. HMR) means we already own the inline style — don't
  // treat the current "hidden" as a foreign restore value.
  if (document.body.hasAttribute(OWNER_ATTR)) {
    savedOverflow = "";
  } else {
    savedOverflow = document.body.style.overflow;
  }
  document.body.style.overflow = "hidden";
  document.body.setAttribute(OWNER_ATTR, "");
}

function releaseOwnership(): void {
  document.body.style.overflow = savedOverflow;
  document.body.removeAttribute(OWNER_ATTR);
  savedOverflow = "";
}

/** Lock document scrolling; returns a release that is safe to call once. */
export function acquireBodyScrollLock(): () => void {
  if (typeof document === "undefined") return () => {};

  if (lockDepth === 0) {
    takeOwnership();
  }
  lockDepth += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockDepth = Math.max(0, lockDepth - 1);
    if (lockDepth === 0 && document.body.hasAttribute(OWNER_ATTR)) {
      releaseOwnership();
    }
  };
}

/**
 * Release a lock we still mark as owned while depth is already 0
 * (e.g. after HMR reset the counter). Does nothing if we do not own the lock.
 */
export function clearOrphanBodyScrollLock(): void {
  if (typeof document === "undefined") return;
  if (lockDepth !== 0) return;
  if (!document.body.hasAttribute(OWNER_ATTR)) return;
  document.body.style.overflow = "";
  document.body.removeAttribute(OWNER_ATTR);
  savedOverflow = "";
}
