import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getPatchNote } from "$lib/patch-notes-catalog";
import { renderPatchNoteBody } from "$lib/patch-notes";

export const load: PageServerLoad = async ({ params }) => {
  const note = getPatchNote(params.slug);
  if (!note) {
    error(404, "Patch note not found");
  }
  return {
    note: {
      slug: note.slug,
      title: note.title,
      date: note.date,
      summary: note.summary,
      html: renderPatchNoteBody(note.body),
    },
    seo: {
      title: `${note.title} · Patch notes · Lightkeepers`,
      description: note.summary,
    },
  };
};
