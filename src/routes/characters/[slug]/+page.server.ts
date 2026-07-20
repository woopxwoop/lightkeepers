import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getCharacterKit } from "$lib/server/character-kit";
import { getCharacterSummary } from "$lib/server/character-summary";
import { toGoodKey } from "$lib/utils";

export const load: PageServerLoad = async ({ params }) => {
  const kit = await getCharacterKit(params.slug);
  if (!kit) {
    error(404, `Character "${params.slug}" not found`);
  }

  const builds = await getCharacterSummary(toGoodKey(kit.name));

  return {
    kit,
    builds,
    seo: {
      title: `${kit.name} — Lightkeepers`,
      description: kit.title
        ? `${kit.name} — ${kit.title}. Skills, passives, and constellations.`
        : `${kit.name} character kit — skills, passives, and constellations.`,
    },
  };
};
