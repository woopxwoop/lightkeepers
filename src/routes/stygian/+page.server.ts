import type { PageServerLoad } from "./$types";

/**
 * SEO only — meta teams + enemies load client-side via ensureStaticBoards()
 * so this route is not blocked on the heavy /api/static cold path.
 */
export const load: PageServerLoad = async () => {
  return {
    seo: {
      title: "Stygian Teams — Lightkeepers",
      description:
        "Recommended Stygian Onslaught team compositions for Genshin Impact.",
    },
  };
};
