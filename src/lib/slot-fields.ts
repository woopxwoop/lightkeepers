/**
 * Shared Abyss/Stygian slot → field_*_rate column mapping.
 * Field 1 = top, field 2 = bottom, field 3 = middle (Stygian).
 */
export const SLOT_FIELD_RATE_KEYS = {
  top: "field_1_rate",
  bottom: "field_2_rate",
  middle: "field_3_rate",
} as const;

export type SlotWithFieldRate = keyof typeof SLOT_FIELD_RATE_KEYS;

type FieldRateTeam = {
  field_1_rate?: number | null;
  field_2_rate?: number | null;
  field_3_rate?: number | null;
};

/** Resolve which field_*_rate column a board slot uses. */
export function slotFieldRateKey(
  slot: string,
): (typeof SLOT_FIELD_RATE_KEYS)[SlotWithFieldRate] {
  return (
    SLOT_FIELD_RATE_KEYS[slot as SlotWithFieldRate] ?? SLOT_FIELD_RATE_KEYS.top
  );
}

/** Raw field_*_rate for a slot (0 when missing). */
export function teamSlotFieldRate(team: FieldRateTeam, slot: string): number {
  const key = slotFieldRateKey(slot);
  return team[key] ?? 0;
}
