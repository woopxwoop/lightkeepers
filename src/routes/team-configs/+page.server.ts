import type { PageServerLoad } from "./$types";
import { getInvestmentFile, pickBaselineSim } from "$lib/server/team-config";

export const load: PageServerLoad = async () => {
  try {
    const file = await getInvestmentFile();
    const teams = [...file.teams]
      .map((t) => {
        const baseline = pickBaselineSim(t);
        return {
          team_key: t.team_key,
          team_name: t.team_name,
          characters: t.characters,
          baseline_cost: t.baseline_cost,
          /** Baseline sim `state_key` for /team-configs/[slug]. */
          config_slug: baseline?.state_key ?? null,
        };
      })
      .filter((t) => t.config_slug)
      .sort((a, b) => a.team_name.localeCompare(b.team_name));
    return { teams };
  } catch (e) {
    console.error("team-configs index:", e);
    return { teams: [], error: "Failed to load teams" };
  }
};
