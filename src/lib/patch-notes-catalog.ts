/**
 * Bundled patch-note catalog (Vite eager raw imports of repo-root markdown).
 */
import {
  isPatchNoteFilename,
  parsePatchNoteMarkdown,
  type PatchNote,
} from "$lib/patch-notes";

const rawModules = import.meta.glob("../../patch-notes/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function loadAllNotes(): PatchNote[] {
  const notes: PatchNote[] = [];
  for (const [path, raw] of Object.entries(rawModules)) {
    if (!isPatchNoteFilename(path)) continue;
    notes.push(parsePatchNoteMarkdown(path, raw));
  }
  notes.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.slug < b.slug ? 1 : a.slug > b.slug ? -1 : 0;
  });
  return notes;
}

let cached: PatchNote[] | null = null;

export function listPatchNotes(): PatchNote[] {
  cached ??= loadAllNotes();
  return cached;
}

export function getPatchNote(slug: string): PatchNote | undefined {
  return listPatchNotes().find((n) => n.slug === slug);
}
