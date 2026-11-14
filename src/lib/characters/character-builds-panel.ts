/**
 * Builds-panel display helpers: example-team selection, kit icon lookups,
 * and tooltip phrasing, kept pure so the panel stays props → $derived → markup.
 */

import { skillIconUrl, talentIconUrl } from "#lib/asset-urls.js";
import {
  exampleHasHighConfig,
  recommendedSubstatSourceLabel,
  type ExampleRollTier,
  type RecommendedSubstat,
} from "#lib/characters/character-builds.js";
import type { CharacterKit } from "#lib/types/character-kit.js";
import type { CharacterBuildExample } from "#lib/types/investment.js";
import { getUiAssetUrl } from "#lib/utils.js";

/** User pick among diversified examples; empty / unknown → first (highest-DPS) example. */
export function activeBuildExample(
  examples: readonly CharacterBuildExample[],
  pick: string,
): CharacterBuildExample | null {
  if (!examples.length) return null;
  return examples.find((e) => e.state_key === pick) ?? examples[0] ?? null;
}

/** Examples other than the active one, in their original order. */
export function alternateBuildExamples(
  examples: readonly CharacterBuildExample[],
  active: CharacterBuildExample | null,
): CharacterBuildExample[] {
  return examples.filter((e) => e.state_key !== active?.state_key);
}

/** Roll tier the stat-goals card renders for an example. */
export function exampleCardTier(
  example: CharacterBuildExample,
): ExampleRollTier {
  return exampleHasHighConfig(example) ? "high" : "mid";
}

/** Icon for the kit skill in a talent slot (`normal` / `skill` / `burst`). */
export function kitSkillIcon(
  kit: Pick<CharacterKit, "skills">,
  kitType: string,
): string | null {
  const skill = kit.skills.find((s) => s.type === kitType);
  if (!skill) return null;
  return skillIconUrl(skill.icon) ?? getUiAssetUrl(skill.icon);
}

/** Display name + icon for constellation `cons`; falls back to `C{n}`. */
export function kitConstellation(
  kit: Pick<CharacterKit, "constellations">,
  cons: number,
): { name: string; icon: string | null } {
  const constellation = kit.constellations.find((c) => c.index === cons);
  return {
    name: constellation?.name ?? `C${cons}`,
    icon: constellation
      ? (talentIconUrl(constellation.icon) ?? getUiAssetUrl(constellation.icon))
      : null,
  };
}

/** Tooltip line: mean rolls, source phrase, and team count. */
export function substatUsageLabel(
  roll: Pick<RecommendedSubstat, "mean" | "source" | "teams">,
): string {
  const teams = `${roll.teams} team${roll.teams === 1 ? "" : "s"}`;
  return `${roll.mean.toFixed(1)} ${recommendedSubstatSourceLabel(roll.source)} · ${teams}`;
}
