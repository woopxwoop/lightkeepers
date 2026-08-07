export const abyssSlotLabel: Record<string, string> = {
  top: "Top Side",
  bottom: "Bottom Side",
};

export const stygianSlotLabel: Record<string, string> = {
  top: "Field 1",
  middle: "Field 2",
  bottom: "Field 3",
};

/** `stygian_version_enemies.slot_index` → Field 1/2/3 label. */
export function stygianSlotIndexLabel(slotIndex: number): string {
  if (slotIndex === 0) return stygianSlotLabel.top;
  if (slotIndex === 1) return stygianSlotLabel.middle;
  if (slotIndex === 2) return stygianSlotLabel.bottom;
  return `Field ${slotIndex + 1}`;
}
