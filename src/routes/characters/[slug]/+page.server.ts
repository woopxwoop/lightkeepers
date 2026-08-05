import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import type { CharacterKit } from "$lib/types/character-kit";
import {
  getCharacterKit,
  getTravelerElementKits,
} from "$lib/server/character-kit";
import { getCharacterSummary } from "$lib/server/character-summary";
import { simCharacterKey } from "$lib/utils";

/** null = no such character (404); a throw = CDN trouble, so 503 not 404. */
async function loadKit(slug: string): Promise<CharacterKit | null> {
  try {
    return await getCharacterKit(slug);
  } catch (err) {
    console.error(`[characters] kit load failed for ${slug}:`, err);
    error(503, "Character data is temporarily unavailable");
  }
}

export const load: PageServerLoad = async ({ params }) => {
  const kit = await loadKit(params.slug);
  if (!kit) {
    error(404, `Character "${params.slug}" not found`);
  }

  const [builds, travelerKits] = await Promise.all([
    getCharacterSummary(simCharacterKey(kit)),
    kit.is_traveler ? getTravelerElementKits(kit) : Promise.resolve({}),
  ]);

  return {
    kit,
    builds,
    travelerKits,
    seo: {
      title: `${kit.name} — Lightkeepers`,
      description: kit.title
        ? `${kit.name} — ${kit.title}. Skills, passives, and constellations.`
        : `${kit.name} character kit — skills, passives, and constellations.`,
    },
  };
};
