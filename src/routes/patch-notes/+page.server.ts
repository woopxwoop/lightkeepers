import type { PageServerLoad } from "./$types";
import { listPatchNotes } from "$lib/patch-notes-catalog";

export const load: PageServerLoad = async () => {
  const notes = listPatchNotes().map(({ slug, title, date, summary }) => ({
    slug,
    title,
    date,
    summary,
  }));
  return {
    notes,
    seo: {
      title: "Patch notes · Lightkeepers",
      description:
        "Product updates for Lightkeepers — roster sync, team tools, and site changes.",
    },
  };
};
