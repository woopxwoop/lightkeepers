/**
 * TCG character card availability.
 *
 * CDN objects: `characters/{name_id}/card.webp`
 * Manifest:    `characters/tcg-cards.json` → `{ name_ids: string[] }`
 * (written by `scripts/sync/tcg-cards-r2.ts` in the main develop tree)
 *
 * Traveler is not in the Drive sync set — {@link MANUAL_TCG_CARD_NAME_IDS}
 * always includes the manually uploaded stem (`PlayerBoy`). Keep that list
 * aligned with the sync script’s `MANUAL_TCG_CARD_NAME_IDS`.
 */

/** Stems always treated as having a card (manual R2 uploads). */
export const MANUAL_TCG_CARD_NAME_IDS: readonly string[] = ["PlayerBoy"];

export type TcgCardsFile = {
  name_ids: string[];
};

export function mergeTcgCardNameIds(
  ids: readonly string[] | null | undefined,
): string[] {
  const out = new Set<string>(MANUAL_TCG_CARD_NAME_IDS);
  for (const id of ids ?? []) {
    if (typeof id === "string" && id) out.add(id);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

export function parseTcgCardsFile(raw: unknown): TcgCardsFile {
  const ids =
    raw &&
    typeof raw === "object" &&
    Array.isArray((raw as TcgCardsFile).name_ids)
      ? (raw as TcgCardsFile).name_ids.filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : [];
  return { name_ids: mergeTcgCardNameIds(ids) };
}

/** `stem` should already be {@link uiAssetNameId}-normalized. */
export function stemHasTcgCard(
  nameIds: ReadonlySet<string>,
  stem: string | null | undefined,
): boolean {
  if (!stem) return false;
  return nameIds.has(stem);
}
