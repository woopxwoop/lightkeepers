import type { PageServerLoad } from "./$types";

/**
 * SEO only — meta teams + enemies load client-side via ensureStaticBoards()
 * so this route is not blocked on the heavy /api/static cold path.
 */
export const load: PageServerLoad = async () => {
  return {
    seo: {
      title: "Abyss Teams — Lightkeepers",
      description:
        "Recommended Spiral Abyss team compositions for Genshin Impact.",
    },
  };
};
