/**
 * Last in-app navigation source, for history-aware back links.
 *
 * Root layout calls {@link rememberNavigation} from `afterNavigate`.
 * {@link canPopTo} is true when that source matches a fallback path — so
 * "← Teams" can restore `/teams?char=…` via `history.back()`, but won't
 * bounce to an unrelated previous page.
 */

let previousUrl: URL | null = null;

export function rememberNavigation(from: URL | null | undefined): void {
  previousUrl = from ?? null;
}

/** True when the previous page is the same path as `href` (query ignored). */
export function canPopTo(href: string): boolean {
  if (!previousUrl) return false;
  try {
    const target = new URL(href, previousUrl.origin);
    return (
      previousUrl.origin === target.origin &&
      previousUrl.pathname === target.pathname
    );
  } catch {
    return false;
  }
}
