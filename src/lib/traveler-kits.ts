/**
 * Traveler multi-element kit helpers.
 *
 * Convention: elemental kits live at `{name_id}-{Element}.json` on the CDN
 * (e.g. `PlayerBoy-Anemo.json`). The base `{name_id}.json` still fills its
 * `element` slot when that file is missing — so today's single Pyro upload
 * keeps working.
 */
import type { CharacterKit } from "$lib/types/character-kit";
import { TRAVELER_ELEMENTS, type TravelerElement } from "$lib/utils";

/** CDN name_id for one Traveler resonance kit. */
export function travelerElementKitId(
  nameId: string,
  element: TravelerElement | string,
): string {
  return `${nameId}-${element}`;
}

/**
 * Merge base + per-element kits into a stable element → kit map.
 * Element-specific files win; base kit fills `base.element` when absent.
 */
export function mergeTravelerKits(
  base: CharacterKit,
  byElement: Partial<Record<string, CharacterKit | null | undefined>>,
): Record<TravelerElement, CharacterKit> | Record<string, CharacterKit> {
  const out: Record<string, CharacterKit> = {};

  for (const element of TRAVELER_ELEMENTS) {
    const kit = byElement[element];
    if (kit) out[element] = kit;
  }

  if (base.element && !out[base.element]) {
    out[base.element] = base;
  }

  return out;
}

/** Elements that have a kit, in release order. */
export function availableTravelerElements(
  kits: Record<string, CharacterKit>,
): TravelerElement[] {
  return TRAVELER_ELEMENTS.filter((element) => Boolean(kits[element]));
}

/** Default Skills-tab element: base kit element when present, else first available. */
export function defaultTravelerElement(
  kits: Record<string, CharacterKit>,
  baseElement: string | null | undefined,
): TravelerElement | "" {
  if (baseElement && kits[baseElement]) {
    return baseElement as TravelerElement;
  }
  return availableTravelerElements(kits)[0] ?? "";
}
