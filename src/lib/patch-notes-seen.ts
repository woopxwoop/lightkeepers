/** localStorage key for the latest patch-note slug the user has acknowledged. */
export const PATCH_NOTES_SEEN_KEY = "patchNotesSeenSlug";

export function readSeenPatchNoteSlug(): string | null {
  try {
    return localStorage.getItem(PATCH_NOTES_SEEN_KEY);
  } catch {
    return null;
  }
}

export function writeSeenPatchNoteSlug(slug: string): void {
  try {
    localStorage.setItem(PATCH_NOTES_SEEN_KEY, slug);
  } catch {
    // privacy mode / blocked — popup may reappear; acceptable
  }
}

/** Show when there is a latest note and it differs from what was last dismissed. */
export function shouldShowPatchNotesPopup(
  latestSlug: string | null | undefined,
  seenSlug: string | null | undefined,
): boolean {
  if (!latestSlug) return false;
  return latestSlug !== (seenSlug ?? null);
}
