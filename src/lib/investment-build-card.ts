import { talentIconUrl } from "$lib/asset-urls";
import type { CharacterKit } from "$lib/types/character-kit";

/** Kit icon strip passed into InvestmentBuildCard. */
export type InvestmentBuildKitIcons = {
  constellations: { index: number; name: string; icon: string | null }[];
  talents: {
    auto: string | null;
    skill: string | null;
    burst: string | null;
  };
};

/** Map a CDN kit into the icon strip InvestmentBuildCard expects. */
export function kitIconsFromCharacterKit(
  kit: Pick<CharacterKit, "skills" | "constellations">,
): InvestmentBuildKitIcons {
  const byType = Object.fromEntries(
    kit.skills.map((s) => [s.type, talentIconUrl(s.icon)]),
  );
  return {
    constellations: [...kit.constellations]
      .sort((a, b) => a.index - b.index)
      .map((c) => ({
        index: c.index,
        name: c.name,
        icon: talentIconUrl(c.icon),
      })),
    talents: {
      auto: byType.normal ?? null,
      skill: byType.skill ?? null,
      burst: byType.burst ?? null,
    },
  };
}
