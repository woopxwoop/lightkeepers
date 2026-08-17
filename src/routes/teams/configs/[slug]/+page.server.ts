import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import {
  findInvestmentSim,
  getInvestmentFile,
  getSimConfigText,
  getSimRotationSample,
} from "$lib/server/team-config";
import { getCharacterKit } from "$lib/server/character-kit";
import { characterBaseByKey } from "$lib/build-stats";
import { getSimConfigUrl } from "$lib/utils";
import {
  kitIconsFromCharacterKit,
  type InvestmentBuildKitIcons,
} from "$lib/investment-build-card";

export type TeamConfigKitIcons = InvestmentBuildKitIcons;

export const load: PageServerLoad = async ({ params }) => {
  const slug = params.slug;
  if (!slug) error(404, "Config not found");

  let file;
  try {
    file = await getInvestmentFile();
  } catch (e) {
    console.error("team-configs investment:", e);
    error(502, "Failed to load team data");
  }

  const match = findInvestmentSim(file, slug);
  if (!match) error(404, `Config "${slug}" not found`);

  const { team, sim } = match;
  const [configText, rotation] = await Promise.all([
    getSimConfigText(sim.state_key).catch((err) => {
      console.warn(
        `[team-configs] sim config ${sim.state_key} unavailable:`,
        err,
      );
      return null;
    }),
    getSimRotationSample(sim.state_key).catch((err) => {
      console.warn(
        `[team-configs] sim rotation ${sim.state_key} unavailable:`,
        err,
      );
      return null;
    }),
  ]);

  const kitsByKey: Record<string, TeamConfigKitIcons> = {};
  await Promise.all(
    sim.characters.map(async (build) => {
      const base = characterBaseByKey.get(build.key);
      if (!base) return;
      // Kit icons are decorative here, so a CDN hiccup drops the icons rather
      // than the page.
      const kit = await getCharacterKit(base.name_id).catch((err) => {
        console.warn(`[team-configs] kit ${base.name_id} unavailable:`, err);
        return null;
      });
      if (!kit) return;
      kitsByKey[build.key] = kitIconsFromCharacterKit(kit);
    }),
  );

  return {
    slug,
    team,
    sim,
    configText,
    rotation,
    configUrl: getSimConfigUrl(sim.state_key),
    kitsByKey,
  };
};
