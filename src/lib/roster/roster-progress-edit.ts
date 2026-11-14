/**
 * Pure edit steps for the roster build card (constellations, talents, level).
 * Each returns the next progress to commit, or `null` when nothing changes.
 */

import type { RosterProgress } from "#lib/definitions.js";
import {
  MAX_ASCENSION,
  MAX_TALENT,
  clampLevelToAscension,
  levelCapForAscension,
} from "#lib/planner/upgrade-costs.js";
import { MAX_CONSTELLATION } from "#lib/roster/roster-progress.js";

export type TalentSlot = "normal" | "skill" | "burst";

export type LevelField = "level" | "cap";

/** Resulting constellation if the user activates constellation `index`. */
export function constellationAfterActivate(
  current: number,
  index: number,
): number {
  const clamped = Math.max(0, Math.min(MAX_CONSTELLATION, index));
  const next = current >= clamped ? clamped - 1 : clamped;
  return Math.max(0, Math.min(MAX_CONSTELLATION, next));
}

/** Click Cn: unlock through n, or drop to n−1 if already unlocked. */
export function activateConstellation(
  progress: RosterProgress,
  index: number,
): RosterProgress {
  return {
    ...progress,
    constellation: constellationAfterActivate(progress.constellation, index),
    talents: { ...progress.talents },
    weapon: progress.weapon,
  };
}

export function stepConstellation(
  progress: RosterProgress,
  delta: number,
): RosterProgress {
  return {
    ...progress,
    constellation: Math.max(
      0,
      Math.min(MAX_CONSTELLATION, progress.constellation + delta),
    ),
    talents: { ...progress.talents },
    weapon: progress.weapon,
  };
}

export function stepTalent(
  progress: RosterProgress,
  slot: TalentSlot,
  delta: number,
): RosterProgress | null {
  const cur = progress.talents[slot];
  const next = Math.max(1, Math.min(MAX_TALENT, cur + delta));
  if (next === cur) return null;
  return {
    ...progress,
    talents: { ...progress.talents, [slot]: next },
    weapon: progress.weapon,
  };
}

/** Ascension whose level cap is nearest to a typed cap (ties → lower). */
export function ascensionForCapInput(raw: number): number {
  const target = Math.round(raw);
  let best = 0;
  let bestDist = Infinity;
  for (let a = 0; a <= MAX_ASCENSION; a++) {
    const cap = levelCapForAscension(a);
    const dist = Math.abs(cap - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = a;
    }
  }
  return best;
}

/** Text a level field starts from when it opens for editing. */
export function levelFieldDraft(
  progress: RosterProgress,
  field: LevelField,
): string {
  return field === "level"
    ? String(progress.level)
    : String(levelCapForAscension(progress.ascension));
}

/**
 * Apply a typed level / cap. `null` when the text is empty (a cleared field
 * cancels; `Number("")` would be 0 and save level 1), not a number, or
 * changes nothing.
 */
export function progressWithLevelInput(
  progress: RosterProgress,
  field: LevelField,
  text: string,
): RosterProgress | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const raw = Number(trimmed);
  if (!Number.isFinite(raw)) return null;
  const { level, ascension } =
    field === "level"
      ? clampLevelToAscension(raw, progress.ascension)
      : clampLevelToAscension(progress.level, ascensionForCapInput(raw));
  if (level === progress.level && ascension === progress.ascension) {
    return null;
  }
  return {
    ...progress,
    level,
    ascension,
    talents: { ...progress.talents },
    weapon: progress.weapon,
  };
}
